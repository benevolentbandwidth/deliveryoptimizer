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

port="$("${python3_bin}" - <<'PY'
import socket

sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
)"

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
VROOM_BIN="/usr/bin/true" \
"${api_binary}" >"${tmpdir}/server.log" 2>&1 &
server_pid=$!

if ! wait_for_local_optimize_ready "${curl_bin}" "${port}" 50 0.1; then
  echo "server failed to start on port ${port}" >&2
  cat "${tmpdir}/server.log" >&2 || true
  exit 1
fi

response_file="${tmpdir}/response.json"
status_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "http://127.0.0.1:${port}/api/v1/deliveries/optimize")"

if [[ "${status_code}" != "413" ]]; then
  echo "expected 413 for oversized request body, got ${status_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
