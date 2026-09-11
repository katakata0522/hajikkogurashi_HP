#!/usr/bin/env bash
set -euo pipefail

is_transient_network_exit_code() {
  case "$1" in
    # rsync socket/protocol/timeout failures plus SSH transport failures.
    10|12|30|35|255)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

run_with_transient_retry() {
  local label="$1"
  local max_attempts="$2"
  shift 2
  local attempt=1

  while true; do
    echo "$label (attempt $attempt/$max_attempts)"
    if "$@"; then
      return 0
    else
      local exit_code=$?
    fi

    if ! is_transient_network_exit_code "$exit_code"; then
      echo "::error::$label failed with non-transient exit code $exit_code; not retrying."
      return "$exit_code"
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "::error::$label failed after $max_attempts attempts (last exit code: $exit_code)."
      return "$exit_code"
    fi

    local delay=$((attempt * 15))
    echo "::warning::$label hit a transient SSH/network failure (exit code $exit_code); retrying in ${delay}s."
    sleep "$delay"
    attempt=$((attempt + 1))
  done
}
