#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 47000 "$@"
response_file="${work_dir}/response.json"
response_headers_file="${work_dir}/response.headers"
metrics_file="${work_dir}/metrics.txt"
payload_file="${work_dir}/payload.json"
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
  DELIVERYOPTIMIZER_ENABLE_METRICS=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES=2
http_server_wait_until_ready

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1 },
    { "id": "order-2", "location": ["bad", 43.7310], "demand": 1 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -D "${response_headers_file}" -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "422" ]]; then
  echo "expected HTTP 422 for an over-threshold solve before deep validation, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ -f "${vroom_called_file}" ]]; then
  echo "expected over-threshold solve to be rejected before invoking VROOM" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

request_id="$(awk 'tolower($1) == "x-request-id:" {gsub("\r", "", $2); print $2}' "${response_headers_file}")"
if [[ -z "${request_id}" ]]; then
  echo "expected rejected solve response to include X-Request-Id" >&2
  cat "${response_headers_file}" >&2 || true
  exit 1
fi

if ! grep -Fq "\"request_id\":\"${request_id}\"" "${log_file}"; then
  echo "expected rejection request id to appear in structured logs" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

metrics_http_code="$("${curl_bin}" -sS -o "${metrics_file}" -w "%{http_code}" \
  "$(http_server_url /metrics)")"

if [[ "${metrics_http_code}" != "200" ]]; then
  echo "expected /metrics to return HTTP 200 after rejection, got ${metrics_http_code}" >&2
  cat "${metrics_file}" >&2 || true
  exit 1
fi

for expected in \
  'deliveryoptimizer_solver_requests_accepted_total 0' \
  'deliveryoptimizer_solver_requests_succeeded_total 0' \
  'deliveryoptimizer_solver_requests_rejected_total 1'; do
  if ! grep -Fq "${expected}" "${metrics_file}"; then
    echo "expected metrics output to contain '${expected}'" >&2
    cat "${metrics_file}" >&2 || true
    exit 1
  fi
done
