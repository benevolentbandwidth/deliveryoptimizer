#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

e2e_init "$@"
osrm_ready_file="${work_dir}/osrm-nearest-ready.json"
health_file="${work_dir}/health.json"
response_file="${work_dir}/optimize-malformed-response.json"

e2e_stack_up
e2e_wait_for_osrm_nearest_ok "${osrm_ready_file}"
e2e_wait_for_api_health "${health_file}"

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary '{"depot":' \
  "http://127.0.0.1:${api_port}/api/v1/deliveries/optimize")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for malformed JSON optimize payload, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Request body must be valid JSON\."' "${response_file}"; then
  echo "malformed payload response missing parse error" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
