#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 37000 "$@"
response_file="${work_dir}/response.json"
response_headers_file="${work_dir}/response.headers"
metrics_file="${work_dir}/metrics.txt"
payload_file="${work_dir}/payload.json"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

sleep 3
cat <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[],"unassigned":[]}
JSON
SH
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}" DELIVERYOPTIMIZER_ENABLE_METRICS=1 VROOM_TIMEOUT_SECONDS=1
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

http_code="$("${curl_bin}" -sS -D "${response_headers_file}" -o "${response_file}" -w "%{http_code}" \
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

request_id="$(awk 'tolower($1) == "x-request-id:" {gsub("\r", "", $2); print $2}' "${response_headers_file}")"
if [[ -z "${request_id}" ]]; then
  echo "expected timeout response to include X-Request-Id" >&2
  cat "${response_headers_file}" >&2 || true
  exit 1
fi

if ! grep -Fq "\"request_id\":\"${request_id}\"" "${log_file}"; then
  echo "expected timeout request id to appear in structured logs" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

metrics_http_code="$("${curl_bin}" -sS -o "${metrics_file}" -w "%{http_code}" \
  "$(http_server_url /metrics)")"

if [[ "${metrics_http_code}" != "200" ]]; then
  echo "expected /metrics to return HTTP 200 after timeout, got ${metrics_http_code}" >&2
  cat "${metrics_file}" >&2 || true
  exit 1
fi

for expected in \
  'deliveryoptimizer_solver_requests_accepted_total 1' \
  'deliveryoptimizer_solver_requests_succeeded_total 0' \
  'deliveryoptimizer_solver_requests_timed_out_total 1' \
  'deliveryoptimizer_solver_duration_seconds_count 1'; do
  if ! grep -Fq "${expected}" "${metrics_file}"; then
    echo "expected metrics output to contain '${expected}'" >&2
    cat "${metrics_file}" >&2 || true
    exit 1
  fi
done
