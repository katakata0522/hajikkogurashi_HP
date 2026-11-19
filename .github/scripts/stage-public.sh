#!/usr/bin/env bash
set -euo pipefail
PUBLIC_DIR="$RUNNER_TEMP/corner-neighbor-public"
mkdir "$PUBLIC_DIR"

rsync -a \
  --exclude ".git/" \
  --exclude ".github/" \
  --exclude "scripts/" \
  --exclude "node_modules/" \
  --exclude "_codex_screens/" \
  --exclude "package.json" \
  --exclude "package-lock.json" \
  --exclude "playwright-report/" \
  --exclude "test-results/" \
  --exclude "assets/css/custom.dev.css" \
  --exclude "assets/css/components/" \
  --exclude "assets/js/ie/" \
  --exclude "*.py" \
  --exclude "*.md" \
  --exclude ".gitignore" \
  --exclude ".gitattributes" \
  --exclude ".gitlab-ci.yml" \
  ./ "$PUBLIC_DIR/"

test -f "$PUBLIC_DIR/index.html"
test -f "$PUBLIC_DIR/deploy-version.txt"
test -f "$PUBLIC_DIR/assets/css/custom.css"
test ! -e "$PUBLIC_DIR/node_modules"
test ! -e "$PUBLIC_DIR/_codex_screens"
test ! -e "$PUBLIC_DIR/package.json"
test ! -e "$PUBLIC_DIR/package-lock.json"
test ! -e "$PUBLIC_DIR/assets/css/custom.dev.css"
test ! -e "$PUBLIC_DIR/assets/css/components"
test ! -e "$PUBLIC_DIR/assets/js/ie"
echo "PUBLIC_DIR=$PUBLIC_DIR" >> "$GITHUB_ENV"

# Compare paths, contents, permissions and symlink targets, independent of
# checkout timestamps and of the UID/GID assigned by the hosted runner.
digest=$(tar --sort=name --format=gnu --mtime=@0 --owner=0 --group=0 --numeric-owner -cf - -C "$PUBLIC_DIR" . | sha256sum)
digest=${digest%% *}
printf 'digest=%s\n' "$digest" >> "$GITHUB_OUTPUT"

if [[ -v VERIFIED_DIGEST ]]; then
  if [[ "$VERIFIED_DIGEST" == "$digest" ]]; then
    echo 'reuse=true' >> "$GITHUB_OUTPUT"
    printf 'Reused browser checks for `%s`, public SHA-256 `%s`: %s\n' "$GITHUB_SHA" "$digest" "$VERIFIED_RUN_URL" | tee -a "$GITHUB_STEP_SUMMARY"
  else
    echo 'reuse=false' >> "$GITHUB_OUTPUT"
    echo 'Running browser checks on this build: no matching verified public files.' | tee -a "$GITHUB_STEP_SUMMARY"
  fi
fi
