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

DELIVERYOPTIMIZER_PORT="${port}" \
VROOM_BIN="/usr/bin/true" \
"${api_binary}" >"${tmpdir}/server.log" 2>&1 &
server_pid=$!

if ! wait_for_local_optimize_ready "${curl_bin}" "${port}" 50 0.1; then
  echo "server failed to start on port ${port}" >&2
  cat "${tmpdir}/server.log" >&2 || true
  exit 1
fi

response_file="${tmpdir}/raw-response.txt"
"${python3_bin}" - "${port}" "${response_file}" <<'PY'
import socket
import sys

port = int(sys.argv[1])
response_path = sys.argv[2]
request = (
    f"POST /api/v1/deliveries/optimize HTTP/1.1\r\n"
    f"Host: 127.0.0.1:{port}\r\n"
    "Content-Type: application/json\r\n"
    "Connection: close\r\n"
    f"Content-Length: {64 * 1024 * 1024}\r\n"
    "\r\n"
).encode("ascii")

sock = socket.create_connection(("127.0.0.1", port), timeout=5)
sock.settimeout(5)
sock.sendall(request)
sock.shutdown(socket.SHUT_WR)

chunks = []
while True:
    try:
        data = sock.recv(4096)
    except socket.timeout as exc:
        raise SystemExit(f"timed out waiting for parser-level 413: {exc}") from exc
    if not data:
        break
    chunks.append(data)

with open(response_path, "wb") as handle:
    handle.write(b"".join(chunks))
PY

status_line="$(head -n 1 "${response_file}" | tr -d '\r')"
if [[ "${status_line}" != "HTTP/1.1 413 Request Entity Too Large" ]]; then
  echo "expected immediate parser-level 413, got '${status_line}'" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

optimize_body="${tmpdir}/optimize.json"
optimize_code="$("${curl_bin}" -sS -X POST -o "${optimize_body}" -w "%{http_code}" \
  "http://127.0.0.1:${port}/optimize?deliveries=1&vehicles=1")"
if [[ "${optimize_code}" != "200" ]]; then
  echo "expected server to remain responsive after parser-level 413, got ${optimize_code}" >&2
  cat "${optimize_body}" >&2 || true
  exit 1
fi
