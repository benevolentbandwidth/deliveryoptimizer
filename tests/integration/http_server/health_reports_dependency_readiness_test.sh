#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 36000 "$@"
health_file="${work_dir}/health.json"

http_server_start VROOM_BIN="/tmp/does-not-exist-vroom" OSRM_URL="http://127.0.0.1:9"
http_server_wait_until_responding "/health" "${health_file}"
http_code="${HTTP_SERVER_LAST_HTTP_CODE}"

if [[ "${http_code}" != "503" ]]; then
  echo "expected /health to return HTTP 503 when OSRM and VROOM are unavailable, got ${http_code}" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"degraded"' "${health_file}"; then
  echo "expected /health response status to be degraded when dependencies are unavailable" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"checks"[[:space:]]*:' "${health_file}"; then
  echo "expected /health response to include dependency checks" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi
