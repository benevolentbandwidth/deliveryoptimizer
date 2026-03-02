#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 46000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
vroom_called_file="${work_dir}/vroom-called.txt"
vroom_pid_file="${work_dir}/vroom-pid.txt"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

echo "called" >"${VROOM_CALLED_FILE:?}"
echo "$$" >"${VROOM_PID_FILE:?}"

# Emit more than 8 MiB to stdout to trigger server-side output guardrails.
dd if=/dev/zero bs=1048576 count=9 2>/dev/null | tr '\0' 'A'

# Stay alive to verify the API process monitor reaps/terminates this process on failure.
sleep 30
STUB
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}" VROOM_CALLED_FILE="${vroom_called_file}" VROOM_PID_FILE="${vroom_pid_file}"
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
  --max-time 15 \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "502" ]]; then
  echo "expected HTTP 502 when VROOM output exceeds size cap, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ ! -f "${vroom_called_file}" ]]; then
  echo "expected VROOM stub to be invoked" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

vroom_pid=""
for _ in $(seq 1 50); do
  if [[ -s "${vroom_pid_file}" ]]; then
    vroom_pid="$(cat "${vroom_pid_file}")"
    break
  fi
  sleep 0.1
done

if [[ -z "${vroom_pid}" ]]; then
  echo "expected VROOM PID file to be populated" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

terminated=false
for _ in $(seq 1 50); do
  if ! kill -0 "${vroom_pid}" >/dev/null 2>&1; then
    terminated=true
    break
  fi
  sleep 0.1
done

if [[ "${terminated}" != "true" ]]; then
  echo "expected VROOM process to be terminated and reaped after output-limit failure" >&2
  ps -p "${vroom_pid}" >&2 || true
  exit 1
fi
