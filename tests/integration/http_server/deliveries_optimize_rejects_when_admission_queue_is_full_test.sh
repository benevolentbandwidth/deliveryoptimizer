#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 48000 "$@"
first_response_file="${work_dir}/first-response.json"
second_response_file="${work_dir}/second-response.json"
third_response_file="${work_dir}/third-response.json"
metrics_file="${work_dir}/metrics.txt"
payload_file="${work_dir}/payload.json"
third_payload_file="${work_dir}/third-payload.json"
first_http_code_file="${work_dir}/first-http-code.txt"
second_http_code_file="${work_dir}/second-http-code.txt"
vroom_started_file="${work_dir}/vroom-started.txt"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'STUB'
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

echo "started" >>"${VROOM_STARTED_FILE:?}"
sleep 2
cat <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[],"unassigned":[]}
JSON
STUB
chmod +x "${stub_bin}"

http_server_start \
  VROOM_BIN="${stub_bin}" \
  VROOM_STARTED_FILE="${vroom_started_file}" \
  DELIVERYOPTIMIZER_ENABLE_METRICS=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_CONCURRENCY=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_QUEUE_SIZE=1 \
  DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS=5000
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

cat >"${third_payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": ["bad", 43.7308], "demand": 1 }
  ]
}
JSON

"${curl_bin}" -sS -o "${first_response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)" >"${first_http_code_file}" &
first_pid=$!

for _ in $(seq 1 50); do
  if [[ -f "${vroom_started_file}" ]]; then
    break
  fi
  sleep 0.1
done

if [[ ! -f "${vroom_started_file}" ]]; then
  echo "expected first solve to reach the VROOM stub" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

"${curl_bin}" -sS --max-time 5 -o "${second_response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)" >"${second_http_code_file}" &
second_pid=$!

queue_is_full=false
for _ in $(seq 1 50); do
  metrics_http_code="$("${curl_bin}" -sS -o "${metrics_file}" -w "%{http_code}" \
    "$(http_server_url /metrics)")"
  if [[ "${metrics_http_code}" == "200" ]] &&
    grep -Fq 'deliveryoptimizer_solver_queue_depth 1' "${metrics_file}" &&
    grep -Fq 'deliveryoptimizer_solver_inflight 1' "${metrics_file}"; then
    queue_is_full=true
    break
  fi
  sleep 0.1
done

if [[ "${queue_is_full}" != "true" ]]; then
  echo "expected the second solve to occupy the queue before sending the third request" >&2
  cat "${metrics_file}" >&2 || true
  cat "${log_file}" >&2 || true
  exit 1
fi

third_http_code="$("${curl_bin}" -sS -o "${third_response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${third_payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${third_http_code}" != "503" ]]; then
  echo "expected HTTP 503 when the admission queue is full before deep validation, got ${third_http_code}" >&2
  cat "${third_response_file}" >&2 || true
  exit 1
fi

wait "${first_pid}"
wait "${second_pid}"

if [[ "$(cat "${first_http_code_file}")" != "200" ]]; then
  echo "expected the first queued solve to complete with HTTP 200" >&2
  cat "${first_response_file}" >&2 || true
  exit 1
fi

if [[ "$(cat "${second_http_code_file}")" != "200" ]]; then
  echo "expected the queued solve to complete with HTTP 200 once capacity freed" >&2
  cat "${second_response_file}" >&2 || true
  exit 1
fi
