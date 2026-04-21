#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <env-file> <compose-file> [docker-binary] [curl-binary]" >&2
  exit 2
fi

env_file="$1"
compose_file="$2"
docker_bin="${3:-docker}"
curl_bin="${4:-curl}"
project_name="deliveryoptimizer-smoke-$$_$(date +%s)"
work_dir="$(mktemp -d)"
api_health_file="${work_dir}/api-health.json"
osrm_nearest_file="${work_dir}/osrm-nearest.json"
vroom_help_file="${work_dir}/vroom-help.txt"

if [[ ! -f "${env_file}" ]]; then
  echo "env file not found: ${env_file}" >&2
  exit 2
fi

if [[ ! -f "${compose_file}" ]]; then
  echo "compose file not found: ${compose_file}" >&2
  exit 2
fi

cleanup() {
  "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" \
    down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "${work_dir}"
}
trap cleanup EXIT

resolve_env_value() {
  local key="$1"
  local default_value="$2"
  local value
  value="$(grep -E "^${key}=" "${env_file}" | tail -n1 | cut -d'=' -f2- || true)"
  if [[ -z "${value}" ]]; then
    echo "${default_value}"
    return
  fi
  echo "${value}"
}

api_port="$(resolve_env_value DELIVERYOPTIMIZER_HOST_PORT 8080)"
osrm_internal_port="$(resolve_env_value OSRM_INTERNAL_PORT 5001)"

"${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" \
  up -d --build osrm http-server

osrm_ready=false
for _ in $(seq 1 180); do
  if "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" \
    exec -T osrm curl -fsS \
      "http://127.0.0.1:${osrm_internal_port}/nearest/v1/driving/-122.4194,37.7749?number=1&generate_hints=false" \
      >"${osrm_nearest_file}" 2>/dev/null &&
    grep -Eq '"code"[[:space:]]*:[[:space:]]*"Ok"' "${osrm_nearest_file}"; then
    osrm_ready=true
    break
  fi
  sleep 2
done

if [[ "${osrm_ready}" != "true" ]]; then
  echo "OSRM did not become ready on internal port ${osrm_internal_port}" >&2
  "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" ps >&2 || true
  "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" logs osrm >&2 || true
  exit 1
fi

if ! "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" \
  exec -T http-server vroom --help >"${vroom_help_file}" 2>&1; then
  echo "vroom --help failed in http-server container" >&2
  cat "${vroom_help_file}" >&2 || true
  exit 1
fi

if ! grep -Eq '^Usage:|A command-line utility' "${vroom_help_file}"; then
  echo "unexpected vroom --help output" >&2
  cat "${vroom_help_file}" >&2 || true
  exit 1
fi

if ! "${curl_bin}" -fsS "http://127.0.0.1:${api_port}/health" >"${api_health_file}" 2>/dev/null; then
  echo "http-server health endpoint is unavailable on port ${api_port}" >&2
  "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" logs http-server >&2 || true
  exit 1
fi
