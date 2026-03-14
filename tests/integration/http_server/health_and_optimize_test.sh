#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 20000 "$@"
health_file="${work_dir}/health.json"
optimize_file="${work_dir}/optimize.json"
method_file="${work_dir}/method.json"

# shellcheck disable=SC2119
http_server_start
http_server_wait_until_ready

health_http_code="$("${curl_bin}" -sS -o "${health_file}" -w "%{http_code}" \
  "$(http_server_url /health)")"

if [[ "${health_http_code}" != "200" && "${health_http_code}" != "503" ]]; then
  echo "health endpoint returned unexpected HTTP ${health_http_code}" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"(ok|degraded)"' "${health_file}"; then
  echo "health response did not contain expected status value" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

method_status="$("${curl_bin}" -sS -o "${method_file}" -w "%{http_code}" \
  "$(http_server_url '/optimize?deliveries=4&vehicles=2')")"

if [[ "${method_status}" != "405" ]]; then
  echo "GET /optimize should return 405" >&2
  cat "${method_file}" >&2 || true
  exit 1
fi

"${curl_bin}" -fsS -X POST "$(http_server_url '/optimize?deliveries=4&vehicles=2')" \
  >"${optimize_file}"

if ! grep -Eq '"summary"[[:space:]]*:[[:space:]]*"optimized-plan: deliveries=4, vehicles=2"' \
  "${optimize_file}"; then
  echo "optimize response did not contain expected summary" >&2
  cat "${optimize_file}" >&2 || true
  exit 1
fi
