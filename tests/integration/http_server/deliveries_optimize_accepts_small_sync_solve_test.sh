#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 46000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
vroom_called_file="${work_dir}/vroom-called.txt"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

echo "called" >"${VROOM_CALLED_FILE:?}"

cat >/dev/stdout <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[{"vehicle":1,"steps":[{"type":"start"},{"type":"job","job":1},{"type":"end"}]}],"unassigned":[]}
JSON
STUB
chmod +x "${stub_bin}"

http_server_start \
  VROOM_BIN="${stub_bin}" \
  VROOM_CALLED_FILE="${vroom_called_file}" \
  DELIVERYOPTIMIZER_SOLVER_MAX_CONCURRENCY=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_QUEUE_SIZE=1 \
  DELIVERYOPTIMIZER_SOLVER_QUEUE_WAIT_MS=1000 \
  DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_JOBS=1 \
  DELIVERYOPTIMIZER_SOLVER_MAX_SYNC_VEHICLES=1
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

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "200" ]]; then
  echo "expected HTTP 200 for an admission-eligible solve, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ ! -f "${vroom_called_file}" ]]; then
  echo "expected VROOM stub to be invoked for an accepted solve" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

for expected in \
  '"status"[[:space:]]*:[[:space:]]*"ok"' \
  '"routes"[[:space:]]*:' \
  '"unassigned"[[:space:]]*:'; do
  if ! grep -Eq "${expected}" "${response_file}"; then
    echo "expected accepted solve response to preserve the success payload shape" >&2
    cat "${response_file}" >&2 || true
    exit 1
  fi
done
