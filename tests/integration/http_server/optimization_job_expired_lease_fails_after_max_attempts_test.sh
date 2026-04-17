#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 5 ]]; then
  echo "usage: $0 <server-binary> <curl-binary> <python3-binary> <initdb-binary> <pg_ctl-binary>" >&2
  exit 2
fi

http_server_init 58000 "$1" "$2"
python3_bin="$3"
initdb_bin="$4"
pg_ctl_bin="$5"
payload_file="${work_dir}/payload.json"
submit_file="${work_dir}/submit.json"
status_file="${work_dir}/status.json"
pg_data_dir="${work_dir}/pgdata"
pg_log_file="${work_dir}/postgres.log"
stub_bin="${work_dir}/vroom-stub.sh"
stub_state_dir="${work_dir}/stub-state"
mkdir -p "${stub_state_dir}"
pg_port="$(http_server_compute_default_port 61000)"
pg_dsn="host=127.0.0.1 port=${pg_port} dbname=postgres user=postgres"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

state_dir="${STUB_STATE_DIR:?}"
lock_dir="${state_dir}/lock"
counter_file="${state_dir}/counter"

while ! mkdir "${lock_dir}" 2>/dev/null; do
  sleep 0.01
done

invocation=1
if [[ -f "${counter_file}" ]]; then
  invocation="$(( $(cat "${counter_file}") + 1 ))"
fi
printf '%s' "${invocation}" >"${counter_file}"
rmdir "${lock_dir}"

sleep 0.6
cat >/dev/stdout <<'JSON'
{"summary":{"routes":1,"unassigned":0,"cost":333},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
JSON
STUB
chmod +x "${stub_bin}"

"${initdb_bin}" -A trust -U postgres -D "${pg_data_dir}" >"${work_dir}/initdb.log"
"${pg_ctl_bin}" -D "${pg_data_dir}" -l "${pg_log_file}" -o "-F -p ${pg_port}" -w start

cleanup_postgres() {
  "${pg_ctl_bin}" -D "${pg_data_dir}" -m fast stop >/dev/null 2>&1 || true
}
trap 'cleanup_postgres; http_server_cleanup' EXIT

http_server_start \
  STUB_STATE_DIR="${stub_state_dir}" \
  VROOM_BIN="${stub_bin}" \
  OSRM_URL="http://127.0.0.1:9" \
  DELIVERYOPTIMIZER_PG_DSN="${pg_dsn}" \
  DELIVERYOPTIMIZER_ENABLE_SYNC_OPTIMIZE=0 \
  DELIVERYOPTIMIZER_JOB_WORKERS=1 \
  DELIVERYOPTIMIZER_JOB_POLL_MS=50 \
  DELIVERYOPTIMIZER_JOB_HEARTBEAT_MS=1000 \
  DELIVERYOPTIMIZER_JOB_SWEEP_MS=50 \
  DELIVERYOPTIMIZER_JOB_WORKER_HEALTH_MS=2000 \
  DELIVERYOPTIMIZER_JOB_LEASE_MS=200 \
  DELIVERYOPTIMIZER_JOB_MAX_ATTEMPTS=2 \
  DELIVERYOPTIMIZER_JOB_RESULT_TTL_SECONDS=30

http_server_wait_until_responding "/health" "${status_file}"

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

submit_http_code="$("${curl_bin}" -sS -o "${submit_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/optimization-jobs)")"

if [[ "${submit_http_code}" != "202" ]]; then
  echo "expected HTTP 202 when submitting an optimization job, got ${submit_http_code}" >&2
  cat "${submit_file}" >&2 || true
  exit 1
fi

job_id="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["job_id"])' "${submit_file}")"
status_url="$(http_server_url "/api/v1/optimization-jobs/${job_id}")"

job_failed=false
for _ in $(seq 1 100); do
  status_http_code="$("${curl_bin}" -sS -o "${status_file}" -w "%{http_code}" "${status_url}")"
  if [[ "${status_http_code}" != "200" ]]; then
    echo "expected status endpoint to return HTTP 200, got ${status_http_code}" >&2
    cat "${status_file}" >&2 || true
    exit 1
  fi

  status_value="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "${status_file}")"
  if [[ "${status_value}" == "failed" ]]; then
    job_failed=true
    break
  fi
  sleep 0.1
done

if [[ "${job_failed}" != "true" ]]; then
  echo "expected optimization job to reach failed state after exhausting max attempts" >&2
  cat "${status_file}" >&2 || true
  cat "${log_file}" >&2 || true
  exit 1
fi

status_error="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["error"])' "${status_file}")"
if [[ "${status_error}" != "Optimization job lease expired too many times." ]]; then
  echo "expected failed optimization job to report the lease-expiry error" >&2
  cat "${status_file}" >&2 || true
  exit 1
fi

status_outcome="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["outcome"])' "${status_file}")"
if [[ "${status_outcome}" != "failed" ]]; then
  echo "expected failed optimization job to report outcome=failed" >&2
  cat "${status_file}" >&2 || true
  exit 1
fi

sleep 0.7

status_value="$("${curl_bin}" -sS "${status_url}" | "${python3_bin}" -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
if [[ "${status_value}" != "failed" ]]; then
  echo "expected failed optimization job to stay terminal after max attempts" >&2
  cat "${status_file}" >&2 || true
  cat "${log_file}" >&2 || true
  exit 1
fi

invocation_count="$(cat "${stub_state_dir}/counter")"
if [[ "${invocation_count}" != "2" ]]; then
  echo "expected optimization job to stop retrying after max attempts, got ${invocation_count}" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi
