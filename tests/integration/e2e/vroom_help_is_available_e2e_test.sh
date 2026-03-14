#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
osrm_response_file="${work_dir}/osrm-nearest.json"
vroom_help_file="${work_dir}/vroom-help.txt"

e2e_stack_up
e2e_wait_for_osrm_nearest_ok "${osrm_response_file}"

if ! e2e_compose exec -T http-server vroom --help >"${vroom_help_file}" 2>&1; then
  echo "vroom --help failed in http-server container" >&2
  cat "${vroom_help_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '^Usage:|A command-line utility' "${vroom_help_file}"; then
  echo "unexpected vroom --help output" >&2
  cat "${vroom_help_file}" >&2 || true
  exit 1
fi
