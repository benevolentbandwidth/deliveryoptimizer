#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <server-binary> [curl-binary]" >&2
  exit 2
fi

server_bin="$1"
curl_bin="${2:-curl}"
default_port="$((20000 + ($$ % 20000)))"
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

health_file="$(mktemp_file)"
optimize_file="$(mktemp_file)"
log_file="$(mktemp_file)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "${server_pid}" >/dev/null 2>&1 || true
    wait "${server_pid}" >/dev/null 2>&1 || true
  fi
  rm -f "${health_file}" "${optimize_file}" "${log_file}"
}
trap cleanup EXIT

env DELIVERYOPTIMIZER_PORT="${port}" "${server_bin}" >"${log_file}" 2>&1 &
server_pid=$!

ready=false
for _ in $(seq 1 50); do
  if "${curl_bin}" -fsS "http://127.0.0.1:${port}/health" >"${health_file}" 2>/dev/null; then
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

if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${health_file}"; then
  echo "health response did not contain status=ok" >&2
  cat "${health_file}" >&2 || true
  exit 1
fi

"${curl_bin}" -fsS "http://127.0.0.1:${port}/optimize?deliveries=4&vehicles=2" >"${optimize_file}"

if ! grep -Eq '"summary"[[:space:]]*:[[:space:]]*"optimized-plan: deliveries=4, vehicles=2"' \
  "${optimize_file}"; then
  echo "optimize response did not contain expected summary" >&2
  cat "${optimize_file}" >&2 || true
  exit 1
fi
