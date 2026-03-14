#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 30000 "$@"
response_file="${work_dir}/response.json"
# shellcheck disable=SC2119
http_server_start
http_server_wait_until_ready

http_code="$("${curl_bin}" -sS -X POST -o "${response_file}" -w "%{http_code}" \
  "$(http_server_url '/optimize?deliveries=-1&vehicles=1')")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for negative deliveries, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
