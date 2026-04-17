#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 38300 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

output=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

cat >"${output}" <<'JSON'
{
  "summary": { "routes": 1, "unassigned": 1 },
  "routes": [
    "bad-route",
    {
      "vehicle": 1,
      "steps": [
        "bad-step",
        { "type": "job", "job": 1 }
      ]
    }
  ],
  "unassigned": [
    "bad-entry",
    { "id": 2 }
  ]
}
JSON
SH
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}"
http_server_wait_until_ready

cat >"${payload_file}" <<'JSON'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
    { "id": "order-1", "location": [7.4212, 43.7308], "demand": 1, "service": 180 },
    { "id": "order-2", "location": [7.4261, 43.7412], "demand": 1, "service": 120 }
  ]
}
JSON

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "200" ]]; then
  echo "expected HTTP 200 from deliveries optimize, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  cat "${log_file}" >&2 || true
  exit 1
fi

for key in status summary routes unassigned; do
  if ! grep -Eq '"'"${key}"'"[[:space:]]*:' "${response_file}"; then
    echo "optimize response missing key ${key}" >&2
    cat "${response_file}" >&2 || true
    exit 1
  fi
done

if ! grep -Eq '"vehicle_external_id"[[:space:]]*:[[:space:]]*"van-1"' "${response_file}"; then
  echo "expected optimize response to include vehicle_external_id for valid route entries" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"job_external_id"[[:space:]]*:[[:space:]]*"order-1"' "${response_file}"; then
  echo "expected optimize response to include job_external_id for valid routed job entries" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"job_external_id"[[:space:]]*:[[:space:]]*"order-2"' "${response_file}"; then
  echo "expected optimize response to include job_external_id for valid unassigned entries" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
