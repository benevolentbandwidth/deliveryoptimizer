#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <server-binary> [curl-binary]" >&2
  exit 2
fi

server_bin="$1"
curl_bin="${2:-curl}"
default_port="$((34000 + ($$ % 20000)))"
port="${DELIVERYOPTIMIZER_TEST_PORT:-${default_port}}"
response_file="$(mktemp)"
payload_file="$(mktemp)"
captured_input_file="$(mktemp)"
stub_bin="$(mktemp)"
log_file="$(mktemp)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${response_file}" "${payload_file}" "${captured_input_file}" "${stub_bin}" "${log_file}"
}
trap cleanup EXIT

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

input=""
output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      input="$2"
      shift 2
      ;;
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

cp "${input}" "${VROOM_CAPTURE_INPUT:?}"

cat >"${output}" <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

env DELIVERYOPTIMIZER_PORT="${port}" VROOM_BIN="${stub_bin}" VROOM_CAPTURE_INPUT="${captured_input_file}" "${server_bin}" >"${log_file}" 2>&1 &
server_pid=$!

if ! wait_for_local_optimize_ready "${curl_bin}" "${port}"; then
  echo "server failed to start on port ${port}" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    {
      "id": "van-1",
      "capacity": 8,
      "start": [7.5000, 43.8000],
      "end": [7.6000, 43.9000]
    }
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

if [[ "${http_code}" != "200" ]]; then
  echo "expected HTTP 200 from deliveries optimize, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '\[[[:space:]]*7\.5[0-9]*[[:space:]]*,[[:space:]]*43\.8[0-9]*[[:space:]]*\]' "${captured_input_file}"; then
  echo "expected optimize request to preserve vehicle start coordinates" >&2
  cat "${captured_input_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '\[[[:space:]]*(7\.6[0-9]*|7\.59[0-9]*)[[:space:]]*,[[:space:]]*(43\.9[0-9]*|43\.89[0-9]*)[[:space:]]*\]' "${captured_input_file}"; then
  echo "expected optimize request to preserve vehicle end coordinates" >&2
  cat "${captured_input_file}" >&2 || true
  exit 1
fi
