#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <api-binary> <python3> <curl>" >&2
  exit 64
fi

api_binary="$1"
python3_bin="$2"
curl_bin="$3"

tmpdir="$(mktemp -d)"
server_pid=""
cleanup() {
  if [[ -n "${server_pid}" ]] && kill -0 "${server_pid}" 2>/dev/null; then
    kill "${server_pid}" 2>/dev/null || true
    wait "${server_pid}" 2>/dev/null || true
  fi
  rm -rf "${tmpdir}"
}
trap cleanup EXIT

if [[ -n "${DELIVERYOPTIMIZER_TEST_PORT:-}" ]]; then
  port="${DELIVERYOPTIMIZER_TEST_PORT}"
else
  port="$("${python3_bin}" - <<'PY'
import socket

sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
)"
fi
http_server_require_valid_port "${port}" "port" || exit 1

payload_file="${tmpdir}/oversized.json"
"${python3_bin}" - "${payload_file}" <<'PY'
import json
import sys

payload_path = sys.argv[1]
payload = {
    "depot": {"location": [-122.4194, 37.7749]},
    "vehicles": [{"id": "vehicle-1", "capacity": 1}],
    "jobs": [
        {
            "id": "job-1",
            "location": [-122.4184, 37.7759],
            "demand": 1,
            "notes": "x" * (11 * 1024 * 1024),
        }
    ],
}
with open(payload_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, separators=(",", ":"))
PY

DELIVERYOPTIMIZER_PORT="${port}" \
DELIVERYOPTIMIZER_ENABLE_METRICS=1 \
VROOM_BIN="/usr/bin/true" \
"${api_binary}" >"${tmpdir}/server.log" 2>&1 &
server_pid=$!

if ! wait_for_local_optimize_ready "${curl_bin}" "${port}" 50 0.1; then
  echo "server failed to start on port ${port}" >&2
  cat "${tmpdir}/server.log" >&2 || true
  exit 1
fi

response_file="${tmpdir}/response.json"
response_headers_file="${tmpdir}/response.headers"
metrics_file="${tmpdir}/metrics.txt"
status_code="$("${curl_bin}" -sS -D "${response_headers_file}" -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "http://127.0.0.1:${port}/api/v1/deliveries/optimize")"

if [[ "${status_code}" != "413" ]]; then
  echo "expected 413 for oversized request body, got ${status_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

request_id="$(awk 'tolower($1) == "x-request-id:" {gsub("\r", "", $2); print $2}' "${response_headers_file}")"
if [[ -z "${request_id}" ]]; then
  echo "expected oversized-body response to include X-Request-Id" >&2
  cat "${response_headers_file}" >&2 || true
  exit 1
fi

if ! grep -Fq "\"request_id\":\"${request_id}\"" "${tmpdir}/server.log"; then
  echo "expected oversized-body response to appear in structured logs" >&2
  cat "${tmpdir}/server.log" >&2 || true
  exit 1
fi

if ! grep -Fq '"outcome":"request_too_large"' "${tmpdir}/server.log"; then
  echo "expected oversized-body log line to identify the request-too-large outcome" >&2
  cat "${tmpdir}/server.log" >&2 || true
  exit 1
fi

metrics_http_code="$("${curl_bin}" -sS -o "${metrics_file}" -w "%{http_code}" \
  "http://127.0.0.1:${port}/metrics")"

if [[ "${metrics_http_code}" != "200" ]]; then
  echo "expected /metrics to return HTTP 200 after oversized-body rejection, got ${metrics_http_code}" >&2
  cat "${metrics_file}" >&2 || true
  exit 1
fi

for expected in \
  'deliveryoptimizer_solver_request_duration_seconds_count 1' \
  'deliveryoptimizer_solver_requests_accepted_total 0' \
  'deliveryoptimizer_solver_requests_succeeded_total 0' \
  'deliveryoptimizer_solver_requests_rejected_total 0' \
  'deliveryoptimizer_solver_requests_timed_out_total 0' \
  'deliveryoptimizer_solver_requests_failed_total 0'; do
  if ! grep -Fq "${expected}" "${metrics_file}"; then
    echo "expected metrics output to contain '${expected}'" >&2
    cat "${metrics_file}" >&2 || true
    exit 1
  fi
done
