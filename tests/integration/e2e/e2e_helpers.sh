#!/usr/bin/env bash
set -euo pipefail

e2e_usage() {
  echo "usage: $0 <env-file> <compose-file> [docker-binary] [curl-binary]" >&2
}

e2e_init() {
  if [[ $# -lt 2 ]]; then
    e2e_usage
    exit 2
  fi

  env_file="$1"
  compose_file="$2"
  docker_bin="${3:-docker}"
  curl_bin="${4:-curl}"

  if [[ ! -f "${env_file}" ]]; then
    echo "env file not found: ${env_file}" >&2
    exit 2
  fi

  if [[ ! -f "${compose_file}" ]]; then
    echo "compose file not found: ${compose_file}" >&2
    exit 2
  fi

  project_name="deliveryoptimizer-e2e-$$_$(date +%s)-${RANDOM}"
  work_dir="$(mktemp -d)"
  api_port="$(e2e_resolve_env_value DELIVERYOPTIMIZER_HOST_PORT 8080)"

  trap e2e_cleanup EXIT
}

e2e_resolve_env_value() {
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

e2e_compose() {
  "${docker_bin}" compose -p "${project_name}" --env-file "${env_file}" -f "${compose_file}" "$@"
}

e2e_stack_up() {
  e2e_compose up -d --build osrm http-server
}

e2e_cleanup() {
  e2e_compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "${work_dir}"
}

e2e_dump_logs_and_fail() {
  local message="$1"
  echo "${message}" >&2
  e2e_compose ps >&2 || true
  e2e_compose logs >&2 || true
  exit 1
}

e2e_wait_for_api_health() {
  local output_file="$1"
  local ready=false

  for _ in $(seq 1 180); do
    if "${curl_bin}" -fsS "http://127.0.0.1:${api_port}/health" >"${output_file}" 2>/dev/null; then
      ready=true
      break
    fi
    sleep 2
  done

  if [[ "${ready}" != "true" ]]; then
    e2e_dump_logs_and_fail "http-server did not become ready on port ${api_port}"
  fi
}

e2e_wait_for_osrm_nearest_ok() {
  local output_file="$1"
  local osrm_port
  local ready=false
  osrm_port="$(e2e_resolve_env_value OSRM_INTERNAL_PORT 5001)"

  for _ in $(seq 1 180); do
    if e2e_compose exec -T osrm curl -fsS \
      "http://127.0.0.1:${osrm_port}/nearest/v1/driving/7.4236,43.7384?number=1&generate_hints=false" \
      >"${output_file}" 2>/dev/null &&
      grep -Eq '"code"[[:space:]]*:[[:space:]]*"Ok"' "${output_file}"; then
      ready=true
      break
    fi
    sleep 2
  done

  if [[ "${ready}" != "true" ]]; then
    e2e_dump_logs_and_fail "osrm nearest probe did not succeed"
  fi
}
