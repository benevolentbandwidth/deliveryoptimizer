#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

if [[ $# -lt 6 ]]; then
  echo "usage: $0 <server-binary> <curl-binary> <python3-binary> <initdb-binary> <pg_ctl-binary> <psql-binary>" >&2
  exit 2
fi

http_server_init 55000 "$1" "$2"
python3_bin="$3"
initdb_bin="$4"
pg_ctl_bin="$5"
psql_bin="$6"
health_file="${work_dir}/health.json"
submit_file="${work_dir}/submit.json"
status_file="${work_dir}/status.json"
result_file="${work_dir}/result.json"
stub_bin="${work_dir}/vroom-stub.sh"
osrm_stub="${work_dir}/osrm_stub.py"
osrm_log_file="${work_dir}/osrm.log"
pg_data_dir="${work_dir}/pgdata"
pg_log_file="${work_dir}/postgres.log"
pg_port="$(http_server_compute_default_port 65000)"
osrm_port="$(http_server_compute_default_port 65100)"
pg_dsn="host=127.0.0.1 port=${pg_port} dbname=postgres user=postgres"
osrm_pid=""

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "${stub_bin}"

cat >"${osrm_stub}" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import sys


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"code": "Ok"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
PY

"${python3_bin}" "${osrm_stub}" "${osrm_port}" >"${osrm_log_file}" 2>&1 &
osrm_pid=$!

"${initdb_bin}" -A trust -U postgres -D "${pg_data_dir}" >"${work_dir}/initdb.log"
"${pg_ctl_bin}" -D "${pg_data_dir}" -l "${pg_log_file}" -o "-F -p ${pg_port}" -w start

"${psql_bin}" "${pg_dsn}" -v ON_ERROR_STOP=1 <<'SQL' >"${work_dir}/psql.log"
create table optimization_jobs(id integer);
create table optimization_job_workers(worker_id text primary key);
SQL

cleanup_postgres() {
  "${pg_ctl_bin}" -D "${pg_data_dir}" -m fast stop >/dev/null 2>&1 || true
}

cleanup_osrm_stub() {
  if [[ -n "${osrm_pid}" ]]; then
    kill "${osrm_pid}" >/dev/null 2>&1 || true
    wait "${osrm_pid}" >/dev/null 2>&1 || true
  fi
}

trap 'cleanup_osrm_stub; cleanup_postgres; http_server_cleanup' EXIT

http_server_start \
  VROOM_BIN="${stub_bin}" \
  OSRM_URL="http://127.0.0.1:${osrm_port}" \
  DELIVERYOPTIMIZER_PG_DSN="${pg_dsn}" \
  DELIVERYOPTIMIZER_ENABLE_SYNC_OPTIMIZE=0 \
  DELIVERYOPTIMIZER_JOB_WORKERS=1

http_server_wait_until_responding "/health" "${health_file}"
http_code="${HTTP_SERVER_LAST_HTTP_CODE}"

if [[ "${http_code}" != "503" ]]; then
  echo "expected /health to return HTTP 503 when schema bootstrap fails, got ${http_code}" >&2
  cat "${health_file}" >&2 || true
  cat "${log_file}" >&2 || true
  exit 1
fi

health_checks="$("${python3_bin}" -c 'import json,sys; data=json.load(open(sys.argv[1]))["checks"]; print(data["optimization_jobs_db"]); print(data["optimization_jobs_schema"])' "${health_file}")"
if ! grep -Fxq 'ok' <<<"${health_checks}"; then
  echo "expected health checks to report optimization_jobs_db=ok" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

if ! grep -Fxq 'down' <<<"${health_checks}"; then
  echo "expected health checks to report optimization_jobs_schema=down" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

submit_http_code="$("${curl_bin}" -sS -o "${submit_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary '{"depot":{"location":[7.4236,43.7384]},"vehicles":[{"id":"van-1","capacity":8}],"jobs":[{"id":"order-1","location":[7.4212,43.7308],"demand":1}]}' \
  "$(http_server_url /api/v1/optimization-jobs)")"

if [[ "${submit_http_code}" != "503" ]]; then
  echo "expected optimization job submission to return HTTP 503 when schema is unavailable, got ${submit_http_code}" >&2
  cat "${submit_file}" >&2 || true
  exit 1
fi

status_http_code="$("${curl_bin}" -sS -o "${status_file}" -w "%{http_code}" \
  "$(http_server_url /api/v1/optimization-jobs/example-job)")"

if [[ "${status_http_code}" != "503" ]]; then
  echo "expected optimization job status to return HTTP 503 when schema is unavailable, got ${status_http_code}" >&2
  cat "${status_file}" >&2 || true
  exit 1
fi

result_http_code="$("${curl_bin}" -sS -o "${result_file}" -w "%{http_code}" \
  "$(http_server_url /api/v1/optimization-jobs/example-job/result)")"

if [[ "${result_http_code}" != "503" ]]; then
  echo "expected optimization job result to return HTTP 503 when schema is unavailable, got ${result_http_code}" >&2
  cat "${result_file}" >&2 || true
  exit 1
fi
