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
default_port="$((20000 + ($$ % 1000)))"
port="${DELIVERYOPTIMIZER_TEST_PORT:-${default_port}}"

health_file="$(mktemp_file)"
optimize_file="$(mktemp_file)"
method_file="$(mktemp_file)"
log_file="$(mktemp_file)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${health_file}" "${optimize_file}" "${method_file}" "${log_file}"
}
trap cleanup EXIT

env DELIVERYOPTIMIZER_PORT="${port}" "${server_bin}" >"${log_file}" 2>&1 &
server_pid=$!

if ! wait_for_local_optimize_ready "${curl_bin}" "${port}"; then
  echo "server failed to start on port ${port}" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

health_http_code="$("${curl_bin}" -sS -o "${health_file}" -w "%{http_code}" \
  "http://127.0.0.1:${port}/health")"

if [[ "${health_http_code}" != "200" && "${health_http_code}" != "503" ]]; then
  echo "health endpoint returned unexpected HTTP ${health_http_code}" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"(ok|degraded)"' "${health_file}"; then
  echo "health response did not contain expected status value" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

method_status="$("${curl_bin}" -sS -o "${method_file}" -w "%{http_code}" \
  "http://127.0.0.1:${port}/optimize?deliveries=4&vehicles=2")"

if [[ "${method_status}" != "405" ]]; then
  echo "GET /optimize should return 405" >&2
  cat "${method_file}" >&2 || true
  exit 1
fi

"${curl_bin}" -fsS -X POST "http://127.0.0.1:${port}/optimize?deliveries=4&vehicles=2" \
  >"${optimize_file}"

if ! grep -Eq '"summary"[[:space:]]*:[[:space:]]*"optimized-plan: deliveries=4, vehicles=2"' \
  "${optimize_file}"; then
  echo "optimize response did not contain expected summary" >&2
  cat "${optimize_file}" >&2 || true
  exit 1
fi
