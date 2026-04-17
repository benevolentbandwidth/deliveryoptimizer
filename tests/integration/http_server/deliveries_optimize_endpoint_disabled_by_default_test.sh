#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 51000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"

env DELIVERYOPTIMIZER_PORT="${port}" "${server_bin}" >"${log_file}" 2>&1 &
server_pid=$!

http_server_wait_until_responding "/health" "${response_file}"

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "404" ]]; then
  echo "expected HTTP 404 when the legacy sync optimize endpoint is disabled by default, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
