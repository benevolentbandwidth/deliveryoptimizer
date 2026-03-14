#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
osrm_ready_file="${work_dir}/osrm-nearest-ready.json"
health_file="${work_dir}/health.json"
proxy_file="${work_dir}/osrm-proxy-tile.json"

e2e_stack_up
e2e_wait_for_osrm_nearest_ok "${osrm_ready_file}"
e2e_wait_for_api_health "${health_file}"

http_code="$("${curl_bin}" -sS -o "${proxy_file}" -w "%{http_code}" \
  "http://127.0.0.1:${api_port}/api/v1/osrm/tile/v1/driving/0/0/0.mvt")"

if [[ "${http_code}" != "403" ]]; then
  echo "expected HTTP 403 for blocked OSRM tile service, got ${http_code}" >&2
  cat "${proxy_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"OSRM service not allowed\."' "${proxy_file}"; then
  echo "OSRM tile block response missing expected error message" >&2
  cat "${proxy_file}" >&2 || true
  exit 1
fi
