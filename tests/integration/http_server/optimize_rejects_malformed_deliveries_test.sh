#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <server-binary> [curl-binary]" >&2
  exit 2
fi

server_bin="$1"
curl_bin="${2:-curl}"
default_port="$((34000 + ($$ % 20000)))"
port="${DELIVERYOPTIMIZER_TEST_PORT:-${default_port}}"

mktemp_file() {
  local template="${TMPDIR:-/tmp}/deliveryoptimizer-http.XXXXXX"
  local path
  path="$(mktemp "${template}" 2>/dev/null)" && {
    echo "${path}"
    return
  }
  mktemp -t deliveryoptimizer-http
}

response_file="$(mktemp_file)"
log_file="$(mktemp_file)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${response_file}" "${log_file}"
}
trap cleanup EXIT

env DELIVERYOPTIMIZER_PORT="${port}" "${server_bin}" >"${log_file}" 2>&1 &
server_pid=$!

ready=false
for _ in $(seq 1 50); do
  if "${curl_bin}" -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.2
done

if [[ "${ready}" != "true" ]]; then
  echo "server failed to start on port ${port}" >&2
  cat "${log_file}" >&2 || true
  exit 1
fi

http_code="$("${curl_bin}" -sS -o "${response_file}" -w "%{http_code}" \
  "http://127.0.0.1:${port}/optimize?deliveries=abc&vehicles=1")"

if [[ "${http_code}" != "400" ]]; then
  echo "expected HTTP 400 for malformed deliveries query param, got ${http_code}" >&2
  cat "${response_file}" >&2 || true
  exit 1
fi
