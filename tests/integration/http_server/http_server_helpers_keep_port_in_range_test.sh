#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

computed_port="$(http_server_compute_default_port 46000 19999)"
expected_port="$((46000 + (19999 % (HTTP_SERVER_MAX_PORT - 46000 + 1))))"

if [[ "${computed_port}" != "${expected_port}" ]]; then
  echo "expected bounded port ${expected_port}, got ${computed_port}" >&2
  exit 1
fi

if (( computed_port < 46000 || computed_port > HTTP_SERVER_MAX_PORT )); then
  echo "computed port ${computed_port} fell outside the valid range" >&2
  exit 1
fi

error_file="$(mktemp)"
trap 'rm -f "${error_file}"' EXIT

if http_server_compute_default_port 70000 1 > /dev/null 2>"${error_file}"; then
  echo "expected invalid default port base to fail" >&2
  exit 1
fi

if ! grep -Fq "default_port_base must be an integer in the range 1..65535" "${error_file}"; then
  echo "expected invalid base error message" >&2
  cat "${error_file}" >&2 || true
  exit 1
fi
