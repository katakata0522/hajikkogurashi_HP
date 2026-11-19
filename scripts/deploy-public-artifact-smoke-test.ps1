$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$deployPath = Join-Path $root '.github/workflows/deploy.yml'
$candidatePath = Join-Path $root '.github/workflows/dry-run.yml'
$stagingPath = Join-Path $root '.github/scripts/stage-public.sh'
$gitignorePath = Join-Path $root '.gitignore'

$deploy = Get-Content -LiteralPath $deployPath -Raw
$candidate = Get-Content -LiteralPath $candidatePath -Raw
$staging = Get-Content -LiteralPath $stagingPath -Raw
$gitignore = Get-Content -LiteralPath $gitignorePath

foreach ($workflow in @($candidate, $deploy)) {
    if (-not $workflow.Contains('bash .github/scripts/stage-public.sh')) {
        throw 'Candidate and deployment must stage public files using the same script'
    }
}

$requiredStagingSnippets = @(
    'PUBLIC_DIR="$RUNNER_TEMP/corner-neighbor-public"',
    '--exclude "node_modules/"',
    '--exclude "_codex_screens/"',
    '--exclude "package.json"',
    '--exclude "package-lock.json"',
    '--exclude "assets/css/custom.dev.css"',
    '--exclude "assets/css/components/"',
    '--exclude "assets/js/ie/"',
    '--exclude "*.py"'
)

foreach ($snippet in $requiredStagingSnippets) {
    if (-not $staging.Contains($snippet)) {
        throw "Public staging is missing safeguard: $snippet"
    }
}

if (-not $deploy.Contains('"$PUBLIC_DIR/" $XS_USER@$XS_HOST:$XS_REMOTE_DIR')) {
    throw 'The production transfer must use the validated public directory'
}

if ($deploy.Contains('./ $XS_USER@$XS_HOST:$XS_REMOTE_DIR')) {
    throw 'deploy.yml must not rsync the repository working tree directly to Xserver'
}

$requiredIgnoreEntries = @(
    'node_modules/',
    '_codex_screens/',
    'playwright-report/',
    'test-results/',
    'deploy-version.txt'
)

foreach ($entry in $requiredIgnoreEntries) {
    if ($gitignore -notcontains $entry) {
        throw ".gitignore is missing generated artifact entry: $entry"
    }
}

$trackedNodeModules = @(git -C $root ls-files -- 'node_modules/**')
if ($LASTEXITCODE -ne 0) {
    throw 'git ls-files failed while checking node_modules tracking'
}
if ($trackedNodeModules.Count -gt 0) {
    throw "node_modules must not be tracked (found $($trackedNodeModules.Count) tracked paths)"
}

$trackedScreens = @(git -C $root ls-files -- '_codex_screens/**')
if ($LASTEXITCODE -ne 0) {
    throw 'git ls-files failed while checking _codex_screens tracking'
}
if ($trackedScreens.Count -gt 0) {
    throw "_codex_screens must not be tracked in the active tree (found $($trackedScreens.Count) paths)"
}

$sourceOnlyFiles = @(
    'assets/css/custom.dev.css',
    'assets/css/components/global-ui.css',
    'assets/js/ie/html5shiv.js'
)
foreach ($relativePath in $sourceOnlyFiles) {
    if (-not (Test-Path (Join-Path $root $relativePath))) {
        throw "Expected source-only asset is missing from repository: $relativePath"
    }
}

Write-Host 'deploy public artifact smoke test: ok'
