#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 34000 "$@"
response_file="${work_dir}/response.json"

http_server_start OSRM_URL="http://127.0.0.1:9"
http_server_wait_until_responding "/health" "${response_file}"

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  "$(http_server_url /api/v1/osrm/foobar/v1/driving/-122.4194,37.7749?number=1&generate_hints=false)")"

if [[ "${http_code}" != "403" ]]; then
  echo "expected HTTP 403 for a disallowed OSRM service, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"OSRM service not allowed\."' "${response_file}"; then
  echo "disallowed-service response did not contain the expected error payload" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
