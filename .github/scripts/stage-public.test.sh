#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/stage-public.sh"
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/source/assets/css"
cd "$fixture/source"
printf 'home' > index.html
printf 'style' > assets/css/custom.css
printf 'sha' > deploy-version.txt
printf 'hidden' > .htaccess
export GITHUB_ENV="$fixture/env" GITHUB_OUTPUT="$fixture/output" GITHUB_STEP_SUMMARY="$fixture/summary"
export GITHUB_SHA=fixture VERIFIED_RUN_URL=https://example.invalid/candidate

stage() {
  : > "$GITHUB_OUTPUT"
  RUNNER_TEMP=$(mktemp -d "$fixture/run-XXXXXXXX") bash "$script" >/dev/null
}
unset VERIFIED_DIGEST
stage
VERIFIED_DIGEST=$(sed -n 's/^digest=//p' "$GITHUB_OUTPUT")
[[ "$VERIFIED_DIGEST" =~ ^[0-9a-f]{64}$ ]]
export VERIFIED_DIGEST
touch -d '2020-01-01' index.html
printf 'private' > README.md
stage
grep -Fxq 'reuse=true' "$GITHUB_OUTPUT"

printf 'changed' > .htaccess
stage
grep -Fxq 'reuse=false' "$GITHUB_OUTPUT"
printf 'hidden' > .htaccess
chmod +x index.html
stage
grep -Fxq 'reuse=false' "$GITHUB_OUTPUT"
chmod -x index.html
ln -s index.html alias.html
stage
grep -Fxq 'reuse=false' "$GITHUB_OUTPUT"
rm alias.html
VERIFIED_DIGEST=''
stage
grep -Fxq 'reuse=false' "$GITHUB_OUTPUT"
echo 'Public artifact digest: identical builds reuse; changed bytes, modes, paths and missing receipts run the tests.'
