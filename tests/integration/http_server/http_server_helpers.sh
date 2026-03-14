#!/usr/bin/env bash
set -euo pipefail

server_bin=""
curl_bin=""
port=""
work_dir=""
log_file=""
server_pid=""
HTTP_SERVER_LAST_HTTP_CODE=""
readonly HTTP_SERVER_MAX_PORT=65535

http_server_usage() {
  echo "usage: $0 <server-binary> [curl-binary]" >&2
}

http_server_is_non_negative_integer() {
  local value="$1"
  [[ "${value}" =~ ^[0-9]+$ ]]
}

http_server_require_valid_port() {
  local value="$1"
  local name="$2"

  if ! http_server_is_non_negative_integer "${value}" || (( value < 1 || value > HTTP_SERVER_MAX_PORT )); then
    echo "${name} must be an integer in the range 1..${HTTP_SERVER_MAX_PORT}, got '${value}'" >&2
    return 1
  fi
}

http_server_compute_default_port() {
  local default_port_base="$1"
  local process_id="${2:-$$}"

  http_server_require_valid_port "${default_port_base}" "default_port_base" || return 1
  if ! http_server_is_non_negative_integer "${process_id}"; then
    echo "process_id must be a non-negative integer, got '${process_id}'" >&2
    return 1
  fi

  local offset_window="$((HTTP_SERVER_MAX_PORT - default_port_base + 1))"
  local offset="$((process_id % offset_window))"
  echo "$((default_port_base + offset))"
}

http_server_init() {
  local default_port_base="$1"
  shift

  if [[ $# -lt 1 ]]; then
    http_server_usage
    exit 2
  fi

  server_bin="$1"
  curl_bin="${2:-curl}"
  default_port="$(http_server_compute_default_port "${default_port_base}")"
  port="${DELIVERYOPTIMIZER_TEST_PORT:-${default_port}}"
  http_server_require_valid_port "${port}" "port" || exit 1
  work_dir="$(mktemp -d)"
  log_file="${work_dir}/server.log"
  server_pid=""
  HTTP_SERVER_LAST_HTTP_CODE=""

  trap http_server_cleanup EXIT
}

http_server_cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi

  rm -rf "${work_dir:-}"
}

http_server_start() {
  env DELIVERYOPTIMIZER_PORT="${port}" "$@" "${server_bin}" >"${log_file}" 2>&1 &
  server_pid=$!
}

http_server_url() {
  local path="$1"
  if [[ "${path}" == /* ]]; then
    echo "http://127.0.0.1:${port}${path}"
    return
  fi

  echo "http://127.0.0.1:${port}/${path}"
}

http_server_wait_until_ready() {
  local path="${1:-/optimize?deliveries=1&vehicles=1}"
  local attempts="${2:-50}"
  local interval_seconds="${3:-0.2}"
  local ready=false

  for _ in $(seq 1 "${attempts}"); do
    if [[ "${path}" == "/optimize?deliveries=1&vehicles=1" ]]; then
      HTTP_SERVER_LAST_HTTP_CODE="$("${curl_bin}" -sS -X POST -o /dev/null -w "%{http_code}" \
        "$(http_server_url "${path}")" 2>/dev/null || true)"
      if [[ "${HTTP_SERVER_LAST_HTTP_CODE}" == "200" ]]; then
        ready=true
        break
      fi
    elif "${curl_bin}" -fsS "$(http_server_url "${path}")" >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep "${interval_seconds}"
  done

  if [[ "${ready}" != "true" ]]; then
    echo "server failed to start on port ${port}" >&2
    cat "${log_file}" >&2 || true
    exit 1
  fi
}

http_server_wait_until_responding() {
  local path="${1:-/health}"
  local output_file="${2:-${work_dir}/response.json}"
  local attempts="${3:-50}"
  local interval_seconds="${4:-0.2}"
  local ready=false

  for _ in $(seq 1 "${attempts}"); do
    HTTP_SERVER_LAST_HTTP_CODE="$("${curl_bin}" -sS -o "${output_file}" -w "%{http_code}" \
      "$(http_server_url "${path}")" || true)"
    if [[ "${HTTP_SERVER_LAST_HTTP_CODE}" != "000" ]]; then
      ready=true
      break
    fi
    sleep "${interval_seconds}"
  done

  if [[ "${ready}" != "true" ]]; then
    echo "server failed to start on port ${port}" >&2
    cat "${log_file}" >&2 || true
    exit 1
  fi
}

wait_for_local_optimize_ready() {
  local curl_bin="$1"
  local port="$2"
  local attempts="${3:-50}"
  local sleep_seconds="${4:-0.2}"
  local http_code=""

  for _ in $(seq 1 "${attempts}"); do
    http_code="$("${curl_bin}" -sS -X POST -o /dev/null -w "%{http_code}" \
      "http://127.0.0.1:${port}/optimize?deliveries=1&vehicles=1" 2>/dev/null || true)"
    if [[ "${http_code}" == "200" ]]; then
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  return 1
}
