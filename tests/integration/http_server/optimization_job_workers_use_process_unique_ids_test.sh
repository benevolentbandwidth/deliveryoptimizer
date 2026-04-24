#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 6 ]]; then
  echo "usage: $0 <server-binary> <curl-binary> <python3-binary> <initdb-binary> <pg_ctl-binary> <psql-binary>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

server_bin="$1"
curl_bin="$2"
python3_bin="$3"
initdb_bin="$4"
pg_ctl_bin="$5"
psql_bin="$6"

work_dir="$(mktemp -d)"
log_file_one="${work_dir}/server-one.log"
log_file_two="${work_dir}/server-two.log"
pg_data_dir="${work_dir}/pgdata"
pg_log_file="${work_dir}/postgres.log"
stub_bin="${work_dir}/vroom-stub.sh"
port_one="$(http_server_map_to_safe_bind_port 56000)"
port_two="$(http_server_map_to_safe_bind_port 56001)"
pg_port="$(http_server_map_to_safe_bind_port 56100)"
pg_dsn="host=127.0.0.1 port=${pg_port} dbname=postgres user=postgres"
server_pid_one=""
server_pid_two=""

cleanup() {
  if [[ -n "${server_pid_one}" ]]; then
    kill "${server_pid_one}" >/dev/null 2>&1 || true
    wait "${server_pid_one}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${server_pid_two}" ]]; then
    kill "${server_pid_two}" >/dev/null 2>&1 || true
    wait "${server_pid_two}" >/dev/null 2>&1 || true
  fi
  "${pg_ctl_bin}" -D "${pg_data_dir}" -m fast stop >/dev/null 2>&1 || true
  rm -rf "${work_dir}"
}
trap cleanup EXIT

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "${stub_bin}"

"${initdb_bin}" -A trust -U postgres -D "${pg_data_dir}" >"${work_dir}/initdb.log"
"${pg_ctl_bin}" -D "${pg_data_dir}" -l "${pg_log_file}" -o "-F -p ${pg_port}" -w start

env \
  DELIVERYOPTIMIZER_PORT="${port_one}" \
  DELIVERYOPTIMIZER_ENABLE_SYNC_OPTIMIZE=0 \
  VROOM_BIN="${stub_bin}" \
  OSRM_URL="http://127.0.0.1:9" \
  DELIVERYOPTIMIZER_PG_DSN="${pg_dsn}" \
  DELIVERYOPTIMIZER_JOB_WORKERS=1 \
  DELIVERYOPTIMIZER_JOB_POLL_MS=50 \
  DELIVERYOPTIMIZER_JOB_HEARTBEAT_MS=100 \
  DELIVERYOPTIMIZER_JOB_SWEEP_MS=100 \
  DELIVERYOPTIMIZER_JOB_WORKER_HEALTH_MS=2000 \
  "${server_bin}" >"${log_file_one}" 2>&1 &
server_pid_one=$!

server_one_ready=false
for _ in $(seq 1 80); do
  http_code_one="$("${curl_bin}" -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port_one}/health" || true)"
  if [[ "${http_code_one}" != "000" ]]; then
    server_one_ready=true
    break
  fi
  sleep 0.2
done

if [[ "${server_one_ready}" != "true" ]]; then
  echo "expected first async server to start and respond on /health" >&2
  cat "${log_file_one}" >&2 || true
  exit 1
fi

env \
  DELIVERYOPTIMIZER_PORT="${port_two}" \
  DELIVERYOPTIMIZER_ENABLE_SYNC_OPTIMIZE=0 \
  VROOM_BIN="${stub_bin}" \
  OSRM_URL="http://127.0.0.1:9" \
  DELIVERYOPTIMIZER_PG_DSN="${pg_dsn}" \
  DELIVERYOPTIMIZER_JOB_WORKERS=1 \
  DELIVERYOPTIMIZER_JOB_POLL_MS=50 \
  DELIVERYOPTIMIZER_JOB_HEARTBEAT_MS=100 \
  DELIVERYOPTIMIZER_JOB_SWEEP_MS=100 \
  DELIVERYOPTIMIZER_JOB_WORKER_HEALTH_MS=2000 \
  "${server_bin}" >"${log_file_two}" 2>&1 &
server_pid_two=$!

server_two_ready=false
for _ in $(seq 1 80); do
  http_code_two="$("${curl_bin}" -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port_two}/health" || true)"
  if [[ "${http_code_two}" != "000" ]]; then
    server_two_ready=true
  fi

  if [[ "${server_two_ready}" == "true" ]]; then
    break
  fi
  sleep 0.2
done

if [[ "${server_two_ready}" != "true" ]]; then
  echo "expected second async server to start and respond on /health" >&2
  cat "${log_file_one}" >&2 || true
  cat "${log_file_two}" >&2 || true
  exit 1
fi

worker_counts="$("${psql_bin}" "${pg_dsn}" -At -v ON_ERROR_STOP=1 -c \
  "select count(*), count(distinct worker_id) from optimization_job_workers;")"
total_workers="$(cut -d'|' -f1 <<<"${worker_counts}")"
distinct_workers="$(cut -d'|' -f2 <<<"${worker_counts}")"

if [[ "${total_workers}" != "2" || "${distinct_workers}" != "2" ]]; then
  echo "expected two distinct worker rows after starting two async servers, got ${worker_counts}" >&2
  "${psql_bin}" "${pg_dsn}" -At -c "select worker_id from optimization_job_workers order by worker_id;" >&2 || true
  cat "${log_file_one}" >&2 || true
  cat "${log_file_two}" >&2 || true
  exit 1
fi
