#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <server-binary> [curl-binary]" >&2
  exit 2
fi

server_bin="$1"
curl_bin="${2:-curl}"
default_port="$((38000 + ($$ % 20000)))"
port="${DELIVERYOPTIMIZER_TEST_PORT:-${default_port}}"
response_file="$(mktemp)"
payload_file="$(mktemp)"
stub_bin="$(mktemp)"
log_file="$(mktemp)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${response_file}" "${payload_file}" "${stub_bin}" "${log_file}"
}
trap cleanup EXIT

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

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

sleep 3
cat >"${output}" <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

env DELIVERYOPTIMIZER_PORT="${port}" VROOM_BIN="${stub_bin}" VROOM_TIMEOUT_SECONDS=1 "${server_bin}" >"${log_file}" 2>&1 &
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
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  --max-time 2 \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "http://127.0.0.1:${port}/api/v1/deliveries/optimize" || true)"

if [[ "${http_code}" != "504" ]]; then
  echo "expected HTTP 504 when VROOM exceeds timeout, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
