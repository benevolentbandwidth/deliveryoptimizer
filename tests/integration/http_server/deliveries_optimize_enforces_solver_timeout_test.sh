#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

sleep 3
cat >"${output}" <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}" VROOM_TIMEOUT_SECONDS=1
http_server_wait_until_ready

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
  --max-time 2 \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)" || true)"

if [[ "${http_code}" != "504" ]]; then
  echo "expected HTTP 504 when VROOM exceeds timeout, got ${http_code}" >&2
  if [[ -f "${response_file}" ]]; then
    cat "${response_file}" >&2 || true
  fi
  exit 1
fi
