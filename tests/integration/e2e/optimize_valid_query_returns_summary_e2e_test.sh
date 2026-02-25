#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
health_file="${work_dir}/health.json"
optimize_file="${work_dir}/optimize.json"

e2e_stack_up
e2e_wait_for_api_health "${health_file}"

"${curl_bin}" -fsS "http://127.0.0.1:${api_port}/optimize?deliveries=4&vehicles=2" >"${optimize_file}"

if ! grep -Eq '"summary"[[:space:]]*:[[:space:]]*"optimized-plan: deliveries=4, vehicles=2"' \
  "${optimize_file}"; then
  echo "optimize response did not contain expected summary" >&2
  cat "${optimize_file}" >&2 || true
  exit 1
fi
