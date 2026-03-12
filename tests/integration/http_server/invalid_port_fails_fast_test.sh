#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <server-binary>" >&2
  exit 2
fi

server_bin="$1"
invalid_port="not-a-port"

log_file="$(mktemp_file)"

cleanup() {
  rm -f "${log_file}"
}
trap cleanup EXIT

if env DELIVERYOPTIMIZER_PORT="${invalid_port}" "${server_bin}" >"${log_file}" 2>&1; then
  echo "server unexpectedly started with invalid DELIVERYOPTIMIZER_PORT" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

if ! grep -Fq "Invalid DELIVERYOPTIMIZER_PORT='${invalid_port}'" "${log_file}"; then
  echo "expected invalid port error in server log" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi
