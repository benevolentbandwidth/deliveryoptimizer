#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
captured_input_file="${work_dir}/captured-input.json"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

input=""
output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      input="$2"
      shift 2
      ;;
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

cp "${input}" "${VROOM_CAPTURE_INPUT:?}"

cat >"${output}" <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}" VROOM_CAPTURE_INPUT="${captured_input_file}"
http_server_wait_until_ready

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308] }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "200" ]]; then
  echo "expected HTTP 200 when jobs[].demand is omitted, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"amount"[[:space:]]*:[[:space:]]*\[[[:space:]]*1[[:space:]]*\]' "${captured_input_file}"; then
  echo "expected omitted jobs[].demand to default to 1 in VROOM payload" >&2
  cat "${captured_input_file}" >&2 || true
  exit 1
fi
