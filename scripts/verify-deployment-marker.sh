#!/usr/bin/env bash
set -euo pipefail

url="${1:?usage: verify-deployment-marker.sh <url> <expected-sha>}"
expected="${2:?usage: verify-deployment-marker.sh <url> <expected-sha>}"

for attempt in 1 2 3 4 5; do
  actual="$(curl -fsSL --connect-timeout 10 --max-time 20 "${url}?sha=${expected}&attempt=${attempt}" 2>/dev/null | tr -d '\r\n' || true)"
  if [ "$actual" = "$expected" ]; then
    echo "Deployment marker verified: $actual"
    exit 0
  fi

  if [ "$attempt" -lt 5 ]; then
    echo "::warning::deployment marker attempt $attempt did not match; retrying..."
    sleep $((attempt * 3))
  fi
done

echo "::error::deployment marker verification failed (expected $expected, got ${actual:-<empty>})"
exit 1
