#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
osrm_ready_file="${work_dir}/osrm-nearest-ready.json"
health_file="${work_dir}/health.json"
proxy_file="${work_dir}/osrm-proxy-nearest.json"

e2e_stack_up
e2e_wait_for_osrm_nearest_ok "${osrm_ready_file}"
e2e_wait_for_api_health "${health_file}"

http_code="$("${curl_bin}" -sS -o "${proxy_file}" -w "%{http_code}" \
  "http://127.0.0.1:${api_port}/api/v1/osrm/nearest/v1/driving/7.4236,43.7384?number=1&generate_hints=false")"

if [[ "${http_code}" != "200" ]]; then
  echo "expected HTTP 200 from OSRM proxy nearest, got ${http_code}" >&2
  cat "${proxy_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"code"[[:space:]]*:[[:space:]]*"Ok"' "${proxy_file}"; then
  echo "OSRM proxy nearest response missing code=Ok" >&2
  cat "${proxy_file}" >&2 || true
  exit 1
fi
