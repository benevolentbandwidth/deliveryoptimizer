#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 47000 "$@"
jobs_response_file="${work_dir}/jobs-response.json"
jobs_payload_file="${work_dir}/jobs-payload.json"
vehicles_response_file="${work_dir}/vehicles-response.json"
vehicles_payload_file="${work_dir}/vehicles-payload.json"
vroom_called_file="${work_dir}/vroom-called.txt"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

echo "called" >"${VROOM_CALLED_FILE:?}"
cat >/dev/stdout <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[],"unassigned":[]}
JSON
STUB
chmod +x "${stub_bin}"

http_server_start \
  VROOM_BIN="${stub_bin}" \
  VROOM_CALLED_FILE="${vroom_called_file}" \
  DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES=2
http_server_wait_until_ready

cat >"${jobs_payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1 },
    { "id": "order-2", "location": [7.4220, 43.7310], "demand": 1 }
  ]
}
JSON

jobs_http_code="$("${curl_bin}" -sS -o "${jobs_response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${jobs_payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${jobs_http_code}" != "422" ]]; then
  echo "expected HTTP 422 when jobs exceed the sync-solve limit, got ${jobs_http_code}" >&2
  cat "${jobs_response_file}" >&2 || true
  exit 1
fi

if [[ -f "${vroom_called_file}" ]]; then
  echo "expected over-threshold solve to be rejected before invoking VROOM" >&2
  cat "${jobs_response_file}" >&2 || true
  exit 1
fi

if ! grep -Fq '"error":"Request exceeds the maximum supported job count for synchronous routing optimization."' "${jobs_response_file}"; then
  echo "expected job-count-specific error message for an over-threshold sync solve" >&2
  cat "${jobs_response_file}" >&2 || true
  exit 1
fi

cat >"${vehicles_payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 },
    { "id": "van-2", "capacity": 8 },
    { "id": "van-3", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1 }
  ]
}
JSON

vehicles_http_code="$("${curl_bin}" -sS -o "${vehicles_response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${vehicles_payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${vehicles_http_code}" != "422" ]]; then
  echo "expected HTTP 422 when vehicles exceed the sync-solve limit, got ${vehicles_http_code}" >&2
  cat "${vehicles_response_file}" >&2 || true
  exit 1
fi

if [[ -f "${vroom_called_file}" ]]; then
  echo "expected over-threshold vehicle solve to be rejected before invoking VROOM" >&2
  cat "${vehicles_response_file}" >&2 || true
  exit 1
fi

if ! grep -Fq '"error":"Request exceeds the maximum supported vehicle count for synchronous routing optimization."' "${vehicles_response_file}"; then
  echo "expected vehicle-count-specific error message for an over-threshold sync solve" >&2
  cat "${vehicles_response_file}" >&2 || true
  exit 1
fi
