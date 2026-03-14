#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
health_file="${work_dir}/health.json"

e2e_stack_up
e2e_wait_for_api_health "${health_file}"

if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${health_file}"; then
  echo "health response did not contain status=ok" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi
