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
