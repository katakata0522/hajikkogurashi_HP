#!/usr/bin/env bash
set -euo pipefail

case "$1" in
  static)
    tools=$(pwsh --version)
    ;;
  browser)
    chrome_path=$(command -v google-chrome || command -v google-chrome-stable || true)
    if [[ -z "$chrome_path" ]]; then
      echo '::error::Google Chrome is not available on this GitHub-hosted runner image'
      exit 1
    fi
    chrome_version=$("$chrome_path" --version)
    echo "$chrome_version"
    printf 'CHROME_PATH=%s\n' "$chrome_path" >> "$GITHUB_ENV"
    tools="$chrome_version $(npm --version)"
    ;;
  *) exit 2 ;;
esac

fingerprint=''
if [[ -n ${ImageOS:-} && -n ${ImageVersion:-} && -n ${RUNNER_OS:-} && -n ${RUNNER_ARCH:-} ]]; then
  node_version=$(node --version)
  fingerprint=$(printf '%s\n' "$1" "$ImageOS" "$ImageVersion" "$RUNNER_OS" "$RUNNER_ARCH" "$node_version" "$tools" | sha256sum)
  fingerprint=${fingerprint%% *}
fi
printf 'fingerprint=%s\n' "$fingerprint" >> "$GITHUB_OUTPUT"

reuse=false
if [[ -n "$fingerprint" && "$fingerprint" == "${VERIFIED_FINGERPRINT:-}" ]]; then
  reuse=true
  printf 'Reused %s checks for `%s`: %s\n' "$1" "$GITHUB_SHA" "$VERIFIED_RUN_URL" | tee -a "$GITHUB_STEP_SUMMARY"
elif [[ -n ${VERIFIED_RUN_URL:-} ]]; then
  printf 'Running %s checks locally: runner or tool versions differ from the candidate.\n' "$1"
fi
printf 'reuse=%s\n' "$reuse" >> "$GITHUB_OUTPUT"
