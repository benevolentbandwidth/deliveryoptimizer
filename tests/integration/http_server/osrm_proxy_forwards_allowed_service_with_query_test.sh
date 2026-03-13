#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <server-binary> <python-binary> [curl-binary]" >&2
  exit 2
fi

server_bin="$1"
python_bin="$2"
curl_bin="${3:-curl}"
api_default_port="$((36000 + ($$ % 14000)))"
stub_default_port="$((52000 + ($$ % 10000)))"
api_port="${DELIVERYOPTIMIZER_TEST_PORT:-${api_default_port}}"
stub_port="${DELIVERYOPTIMIZER_OSRM_STUB_PORT:-${stub_default_port}}"

response_file="$(mktemp_file)"
request_path_file="$(mktemp_file)"
ready_file="$(mktemp_file)"
server_log_file="$(mktemp_file)"
stub_log_file="$(mktemp_file)"
rm -f "${request_path_file}" "${ready_file}"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${stub_pid:-}" ]]; then
    kill "${stub_pid}" >/dev/null 2>&1 || true
    wait "${stub_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${response_file}" "${request_path_file}" "${ready_file}" "${server_log_file}" \
    "${stub_log_file}"
}
trap cleanup EXIT

env STUB_PORT="${stub_port}" REQUEST_PATH_FILE="${request_path_file}" READY_FILE="${ready_file}" \
  "${python_bin}" - >"${stub_log_file}" 2>&1 <<'PY' &
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

port = int(os.environ["STUB_PORT"])
request_path_file = os.environ["REQUEST_PATH_FILE"]
ready_file = os.environ["READY_FILE"]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        with open(request_path_file, "w", encoding="utf-8") as path_file:
            path_file.write(self.path)

        payload = b'{"code":"Ok","stub":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        return


server = HTTPServer(("127.0.0.1", port), Handler)
with open(ready_file, "w", encoding="utf-8") as ready:
    ready.write("ready")
server.serve_forever()
PY
stub_pid=$!

stub_ready=false
for _ in $(seq 1 50); do
  if [[ -f "${ready_file}" ]]; then
    stub_ready=true
    break
  fi
  if ! kill -0 "${stub_pid}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if [[ "${stub_ready}" != "true" ]]; then
  echo "OSRM stub failed to start on port ${stub_port}" >&2
  cat "${stub_log_file}" >&2 || true
  exit 1
fi

env DELIVERYOPTIMIZER_PORT="${api_port}" OSRM_URL="http://127.0.0.1:${stub_port}" \
  "${server_bin}" >"${server_log_file}" 2>&1 &
server_pid=$!

ready=false
for _ in $(seq 1 50); do
  if "${curl_bin}" -fsS "http://127.0.0.1:${api_port}/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.2
done

if [[ "${ready}" != "true" ]]; then
  echo "server failed to start on port ${api_port}" >&2
  cat "${server_log_file}" >&2 || true
  exit 1
fi

upstream_path="/nearest/v1/driving/-122.4194,37.7749?number=1&generate_hints=false"
encoded_upstream_path="/nearest/v1/driving/-122.4194%2C37.7749?number=1&generate_hints=false"
"${curl_bin}" -fsS \
  "http://127.0.0.1:${api_port}/api/v1/osrm${upstream_path}" >"${response_file}"

if ! grep -Eq '"stub"[[:space:]]*:[[:space:]]*true' "${response_file}"; then
  echo "forwarded OSRM response did not contain the stub payload" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ ! -f "${request_path_file}" ]]; then
  echo "OSRM stub did not record an upstream request" >&2
  cat "${stub_log_file}" >&2 || true
  exit 1
fi

recorded_path="$(cat "${request_path_file}")"
if [[ "${recorded_path}" != "${upstream_path}" && "${recorded_path}" != "${encoded_upstream_path}" ]]; then
  echo "expected forwarded upstream path '${upstream_path}' or '${encoded_upstream_path}', got '${recorded_path}'" >&2
  cat "${stub_log_file}" >&2 || true
  exit 1
fi
