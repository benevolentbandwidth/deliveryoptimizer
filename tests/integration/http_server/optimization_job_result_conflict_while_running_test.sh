#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 5 ]]; then
  echo "usage: $0 <server-binary> <curl-binary> <python3-binary> <initdb-binary> <pg_ctl-binary>" >&2
  exit 2
fi

http_server_init 53000 "$1" "$2"
python3_bin="$3"
initdb_bin="$4"
pg_ctl_bin="$5"
payload_file="${work_dir}/payload.json"
submit_file="${work_dir}/submit.json"
result_file="${work_dir}/result.json"
status_file="${work_dir}/status.json"
pg_data_dir="${work_dir}/pgdata"
pg_log_file="${work_dir}/postgres.log"
stub_bin="${work_dir}/vroom-stub.sh"
pg_port="$(http_server_compute_default_port 63000)"
pg_dsn="host=127.0.0.1 port=${pg_port} dbname=postgres user=postgres"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
sleep 2
cat >/dev/stdout <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
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
  VROOM_BIN="${stub_bin}" \
  OSRM_URL="http://127.0.0.1:9" \
  DELIVERYOPTIMIZER_PG_DSN="${pg_dsn}" \
  DELIVERYOPTIMIZER_ENABLE_SYNC_OPTIMIZE=0 \
  DELIVERYOPTIMIZER_JOB_WORKERS=1 \
  DELIVERYOPTIMIZER_JOB_POLL_MS=50 \
  DELIVERYOPTIMIZER_JOB_HEARTBEAT_MS=100 \
  DELIVERYOPTIMIZER_JOB_SWEEP_MS=100 \
  DELIVERYOPTIMIZER_JOB_WORKER_HEALTH_MS=500 \
  DELIVERYOPTIMIZER_JOB_LEASE_MS=5000 \
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
result_http_code="$("${curl_bin}" -sS -o "${result_file}" -w "%{http_code}" \
  "$(http_server_url "/api/v1/optimization-jobs/${job_id}/result")")"

if [[ "${result_http_code}" != "202" ]]; then
  echo "expected HTTP 202 while optimization job result is still pending, got ${result_http_code}" >&2
  cat "${result_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"(queued|running)"' "${result_file}"; then
  echo "expected result conflict payload to include queued or running status" >&2
  cat "${result_file}" >&2 || true
  exit 1
fi
