#!/usr/bin/env bash

mktemp_file() {
  local template="${TMPDIR:-/tmp}/deliveryoptimizer-http.XXXXXX"
  local path
  path="$(mktemp "${template}" 2>/dev/null)" && {
    echo "${path}"
    return
  }
  mktemp -t deliveryoptimizer-http
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
