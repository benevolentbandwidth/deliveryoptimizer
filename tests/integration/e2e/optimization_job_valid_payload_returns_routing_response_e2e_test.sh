#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/e2e_helpers.sh"

if [[ $# -lt 5 ]]; then
  echo "usage: $0 <env-file> <compose-file> <docker-binary> <curl-binary> <python3-binary>" >&2
  exit 2
fi

e2e_init "$1" "$2" "$3" "$4"
python3_bin="$5"
osrm_ready_file="${work_dir}/osrm-nearest-ready.json"
health_file="${work_dir}/health.json"
payload_file="${work_dir}/optimize-payload.json"
submit_file="${work_dir}/submit-response.json"
status_file="${work_dir}/status-response.json"
result_file="${work_dir}/result-response.json"

e2e_stack_up
e2e_wait_for_osrm_nearest_ok "${osrm_ready_file}"
e2e_wait_for_api_health "${health_file}"

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 2, "service": 180 },
    { "id": "order-2", "location": [7.4261, 43.7412], "demand": 1, "service": 120 }
  ]
}
JSON

submit_http_code="$("${curl_bin}" -sS -o "${submit_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "http://127.0.0.1:${api_port}/api/v1/optimization-jobs")"

if [[ "${submit_http_code}" != "202" ]]; then
  echo "expected HTTP 202 from optimization job submission, got ${submit_http_code}" >&2
  cat "${submit_file}" >&2 || true
  exit 1
fi

job_id="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["job_id"])' "${submit_file}")"
if [[ -z "${job_id}" ]]; then
  echo "expected optimization job submission response to include job_id" >&2
  cat "${submit_file}" >&2 || true
  exit 1
fi

status_url="http://127.0.0.1:${api_port}/api/v1/optimization-jobs/${job_id}"
result_url="http://127.0.0.1:${api_port}/api/v1/optimization-jobs/${job_id}/result"

job_succeeded=false
for _ in $(seq 1 60); do
  status_http_code="$("${curl_bin}" -sS -o "${status_file}" -w "%{http_code}" "${status_url}")"
  if [[ "${status_http_code}" != "200" ]]; then
    echo "expected optimization job status endpoint to return HTTP 200, got ${status_http_code}" >&2
    cat "${status_file}" >&2 || true
    exit 1
  fi

  status_value="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "${status_file}")"
  if [[ "${status_value}" == "succeeded" ]]; then
    job_succeeded=true
    break
  fi
  sleep 2
done

if [[ "${job_succeeded}" != "true" ]]; then
  echo "expected optimization job to reach succeeded state" >&2
  cat "${status_file}" >&2 || true
  exit 1
fi

result_http_code="$("${curl_bin}" -sS -o "${result_file}" -w "%{http_code}" "${result_url}")"
if [[ "${result_http_code}" != "200" ]]; then
  echo "expected optimization job result endpoint to return HTTP 200, got ${result_http_code}" >&2
  cat "${result_file}" >&2 || true
  exit 1
fi

for key in status summary routes unassigned; do
  if ! grep -Eq '"'"${key}"'"[[:space:]]*:' "${result_file}"; then
    echo "optimization job result missing key ${key}" >&2
    cat "${result_file}" >&2 || true
    exit 1
  fi
done
