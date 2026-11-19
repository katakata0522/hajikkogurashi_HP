#!/usr/bin/env bash
set -euo pipefail

pwsh -File ./scripts/static-site-smoke-test.ps1
pwsh -File ./scripts/home-asset-smoke-test.ps1
pwsh -File ./scripts/structure-smoke-test.ps1
pwsh -File ./scripts/local-reference-check.ps1
pwsh -File ./scripts/deploy-public-artifact-smoke-test.ps1
pwsh -File ./scripts/viewport-accessibility-smoke-test.ps1
pwsh -File ./scripts/deploy-security-smoke-test.ps1
pwsh -File ./scripts/deploy-impact-smoke-test.ps1
bash -n ./.github/scripts/rsync-transient-retry.sh
node --check ./.github/scripts/detect-deploy-impact.cjs
