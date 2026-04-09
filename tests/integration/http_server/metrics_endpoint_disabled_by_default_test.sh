#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38100 "$@"
response_file="${work_dir}/metrics.txt"

http_server_start VROOM_BIN="/usr/bin/true"
http_server_wait_until_ready

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  "$(http_server_url /metrics)")"

if [[ "${http_code}" != "404" ]]; then
  echo "expected /metrics to be disabled by default and return 404, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
