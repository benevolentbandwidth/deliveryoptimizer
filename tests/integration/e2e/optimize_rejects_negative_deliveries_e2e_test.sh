#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
health_file="${work_dir}/health.json"
error_file="${work_dir}/optimize-negative.json"

e2e_stack_up
e2e_wait_for_api_health "${health_file}"

http_code="$("${curl_bin}" -sS -o "${error_file}" -w "%{http_code}" \
  "http://127.0.0.1:${api_port}/optimize?deliveries=-1&vehicles=1")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for negative deliveries, got ${http_code}" >&2
  cat "${error_file}" >&2 || true
  exit 1
fi

for pattern in \
  '"error"[[:space:]]*:[[:space:]]*"invalid optimize query params"' \
  '"deliveries_min"[[:space:]]*:[[:space:]]*1' \
  '"deliveries_max"[[:space:]]*:[[:space:]]*10000' \
  '"vehicles_min"[[:space:]]*:[[:space:]]*1' \
  '"vehicles_max"[[:space:]]*:[[:space:]]*2000'; do
  if ! grep -Eq "${pattern}" "${error_file}"; then
    echo "error response did not contain expected field: ${pattern}" >&2
    cat "${error_file}" >&2 || true
    exit 1
  fi
done
