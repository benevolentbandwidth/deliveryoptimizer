#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
osrm_response_file="${work_dir}/osrm-nearest.json"

e2e_stack_up
e2e_wait_for_osrm_nearest_ok "${osrm_response_file}"
