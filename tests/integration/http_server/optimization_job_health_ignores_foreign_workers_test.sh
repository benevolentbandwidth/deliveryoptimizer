#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 6 ]]; then
  echo "usage: $0 <server-binary> <curl-binary> <python3-binary> <initdb-binary> <pg_ctl-binary> <psql-binary>" >&2
  exit 2
fi

http_server_init 59000 "$1" "$2"
python3_bin="$3"
initdb_bin="$4"
pg_ctl_bin="$5"
psql_bin="$6"
health_file="${work_dir}/health.json"
metrics_file="${work_dir}/metrics.txt"
pg_data_dir="${work_dir}/pgdata"
pg_log_file="${work_dir}/postgres.log"
stub_bin="${work_dir}/vroom-stub.sh"
pg_port="$(http_server_compute_default_port 63000)"
pg_dsn="host=127.0.0.1 port=${pg_port} dbname=postgres user=postgres"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
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
  DELIVERYOPTIMIZER_ENABLE_METRICS=1 \
  DELIVERYOPTIMIZER_JOB_WORKERS=1 \
  DELIVERYOPTIMIZER_JOB_POLL_MS=50 \
  DELIVERYOPTIMIZER_JOB_HEARTBEAT_MS=100 \
  DELIVERYOPTIMIZER_JOB_SWEEP_MS=100 \
  DELIVERYOPTIMIZER_JOB_WORKER_HEALTH_MS=500 \
  DELIVERYOPTIMIZER_JOB_LEASE_MS=5000 \
  DELIVERYOPTIMIZER_JOB_RESULT_TTL_SECONDS=30

http_server_wait_until_responding "/health" "${health_file}"

healthy_workers=0
for _ in $(seq 1 40); do
  health_http_code="$("${curl_bin}" -sS -o "${health_file}" -w "%{http_code}" "$(http_server_url /health)")"
  if [[ "${health_http_code}" != "200" && "${health_http_code}" != "503" ]]; then
    echo "expected /health to return HTTP 200 or 503, got ${health_http_code}" >&2
    cat "${health_file}" >&2 || true
    exit 1
  fi

  healthy_workers="$("${python3_bin}" -c 'import json,sys; print(json.load(open(sys.argv[1]))["checks"]["optimization_job_workers_healthy"])' "${health_file}")"
  if [[ "${healthy_workers}" == "1" ]]; then
    break
  fi
  sleep 0.1
done

if [[ "${healthy_workers}" != "1" ]]; then
  echo "expected local worker heartbeat to become healthy before injecting a foreign worker row" >&2
  cat "${health_file}" >&2 || true
  cat "${log_file}" >&2 || true
  exit 1
fi

"${psql_bin}" "${pg_dsn}" -v ON_ERROR_STOP=1 -c \
  "insert into optimization_job_workers(worker_id, current_job_id, started_at, last_heartbeat_at, updated_at)
   values ('foreign-worker', null, now(), now(), now())
   on conflict (worker_id) do update
     set current_job_id = excluded.current_job_id,
         last_heartbeat_at = excluded.last_heartbeat_at,
         updated_at = excluded.updated_at;"

sleep 0.3

health_http_code="$("${curl_bin}" -sS -o "${health_file}" -w "%{http_code}" "$(http_server_url /health)")"
if [[ "${health_http_code}" != "200" && "${health_http_code}" != "503" ]]; then
  echo "expected /health to keep returning HTTP 200 or 503, got ${health_http_code}" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

health_snapshot="$("${python3_bin}" -c 'import json,sys; data=json.load(open(sys.argv[1])); print(data["checks"]["optimization_job_workers_expected"]); print(data["checks"]["optimization_job_workers_healthy"])' "${health_file}")"
if [[ "${health_snapshot}" != $'1\n1' ]]; then
  echo "expected health worker counts to ignore foreign worker rows" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

metrics_http_code="$("${curl_bin}" -sS -o "${metrics_file}" -w "%{http_code}" "$(http_server_url /metrics)")"
if [[ "${metrics_http_code}" != "200" ]]; then
  echo "expected /metrics to return HTTP 200, got ${metrics_http_code}" >&2
  cat "${metrics_file}" >&2 || true
  exit 1
fi

if ! grep -Fq 'deliveryoptimizer_async_job_workers_healthy 1' "${metrics_file}"; then
  echo "expected metrics to report only the local worker as healthy" >&2
  cat "${metrics_file}" >&2 || true
  exit 1
fi

if grep -Fq 'deliveryoptimizer_async_job_workers_healthy 2' "${metrics_file}"; then
  echo "foreign worker rows should not inflate the local healthy-worker gauge" >&2
  cat "${metrics_file}" >&2 || true
  exit 1
fi
