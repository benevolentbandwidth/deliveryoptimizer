#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/integration/http_server/http_server_helpers.sh
source "${script_dir}/http_server_helpers.sh"

http_server_init 45000 "$@"
response_file="${work_dir}/response.json"
payload_file="${work_dir}/payload.json"
vroom_called_file="${work_dir}/vroom-called.txt"
stub_bin="${work_dir}/vroom-stub.sh"

cat >"${stub_bin}" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

echo "called" >"${VROOM_CALLED_FILE:?}"
cat >/dev/stdout <<'JSON'
{"summary":{"routes":1,"unassigned":0},"routes":[],"unassigned":[]}
JSON
STUB
chmod +x "${stub_bin}"

http_server_start VROOM_BIN="${stub_bin}" VROOM_CALLED_FILE="${vroom_called_file}"
http_server_wait_until_ready

cat >"${payload_file}" <<'JSON_HEAD'
{
  "depot": { "location": [7.4236, 43.7384] },
  "vehicles": [
    { "id": "van-1", "capacity": 8 }
  ],
  "jobs": [
JSON_HEAD

for i in $(seq 1 10001); do
  comma=","
  if [[ "${i}" -eq 10001 ]]; then
    comma=""
  fi
  printf '    { "id": "order-%d", "location": [7.4212, 43.7308], "demand": 1 }%s\n' "${i}" "${comma}" >>"${payload_file}"
done

cat >>"${payload_file}" <<'JSON_TAIL'
  ]
}
JSON_TAIL

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary "@${payload_file}" \
  "$(http_server_url /api/v1/deliveries/optimize)")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for excessive jobs, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '"field"[[:space:]]*:[[:space:]]*"jobs"' "${response_file}"; then
  echo "expected validation issue for jobs array size" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi

if [[ -f "${vroom_called_file}" ]]; then
  echo "expected validation failure before invoking VROOM" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
