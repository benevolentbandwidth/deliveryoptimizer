#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 49000 "$@"
response_file="${work_dir}/response.json"
response_headers_file="${work_dir}/response.headers"

http_server_start VROOM_BIN="/usr/bin/true"
http_server_wait_until_ready

http_code="$("${curl_bin}" -sS -D "${response_headers_file}" -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary '{"depot":' \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for malformed JSON optimize payload, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

request_id="$(awk 'tolower($1) == "x-request-id:" {gsub("\r", "", $2); print $2}' "${response_headers_file}")"
if [[ -z "${request_id}" ]]; then
  echo "expected malformed JSON response to include X-Request-Id" >&2
  cat "${response_headers_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"error"[[:space:]]*:[[:space:]]*"Request body must be valid JSON\."' "${response_file}"; then
  echo "malformed payload response missing parse error" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Fq "\"request_id\":\"${request_id}\"" "${log_file}"; then
  echo "expected malformed JSON request id to appear in structured logs" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi
