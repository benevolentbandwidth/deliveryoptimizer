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
default_port="$((35000 + ($$ % 20000)))"
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

cat >"${output}" <<'JSON'
{
  "summary": { "routes": 1, "unassigned": 1 },
  "routes": [
    {
      "vehicle": 1,
      "steps": [
        { "type": "start" },
        { "type": "job", "job": 1 },
        { "type": "end" }
      ]
    }
  ],
  "unassigned": [
    { "id": 2 }
  ]
}
JSON
SH
chmod +x "${stub_bin}"

env DELIVERYOPTIMIZER_PORT="${port}" VROOM_BIN="${stub_bin}" "${server_bin}" >"${log_file}" 2>&1 &
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
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1, "service": 180 },
    { "id": "order-2", "location": [7.4261, 43.7412], "demand": 1, "service": 120 }
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

if ! grep -Eq '"vehicle_external_id"[[:space:]]*:[[:space:]]*"van-1"' "${response_file}"; then
  echo "expected optimize response to include vehicle_external_id mapping" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"job_external_id"[[:space:]]*:[[:space:]]*"order-1"' "${response_file}"; then
  echo "expected optimize response to include job_external_id mapping for routed jobs" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"job_external_id"[[:space:]]*:[[:space:]]*"order-2"' "${response_file}"; then
  echo "expected optimize response to include job_external_id mapping for unassigned jobs" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
