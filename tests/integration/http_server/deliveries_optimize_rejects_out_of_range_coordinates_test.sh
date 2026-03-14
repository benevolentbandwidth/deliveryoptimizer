#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 41000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
vroom_called_file="${work_dir}/vroom-called.txt"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

echo "called" >"${VROOM_CALLED_FILE:?}"

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

cat >"${output}" <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}" VROOM_CALLED_FILE="${vroom_called_file}"
http_server_wait_until_ready

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [999, 999] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1, "service": 180 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for out-of-range coordinates, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ -f "${vroom_called_file}" ]]; then
  echo "expected validation failure before invoking VROOM" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
