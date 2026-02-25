#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <server-binary> [curl-binary]" >&2
  exit 2
fi

server_bin="$1"
curl_bin="${2:-curl}"
default_port="$((41000 + ($$ % 20000)))"
port="${DELIVERYOPTIMIZER_TEST_PORT:-${default_port}}"
response_file="$(mktemp)"
payload_file="$(mktemp)"
vroom_called_file="$(mktemp)"
stub_bin="$(mktemp)"
log_file="$(mktemp)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${response_file}" "${payload_file}" "${vroom_called_file}" "${stub_bin}" "${log_file}"
}
trap cleanup EXIT

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

echo "called" >"${VROOM_CALLED_FILE:?}"

output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

cat >"${output}" <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

rm -f "${vroom_called_file}"
env DELIVERYOPTIMIZER_PORT="${port}" VROOM_BIN="${stub_bin}" VROOM_CALLED_FILE="${vroom_called_file}" "${server_bin}" >"${log_file}" 2>&1 &
server_pid=$!

ready=false
for _ in $(seq 1 50); do
  if "${curl_bin}" -fsS "http://127.0.0.1:${port}/optimize?deliveries=1&vehicles=1" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.2
done

if [[ "${ready}" != "true" ]]; then
  echo "server failed to start on port ${port}" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [999, 999] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1, "service": 180 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "http://127.0.0.1:${port}/api/v1/deliveries/optimize")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for out-of-range coordinates, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ -f "${vroom_called_file}" ]]; then
  echo "expected validation failure before invoking VROOM" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
