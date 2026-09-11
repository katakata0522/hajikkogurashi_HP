$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$deployPath = Join-Path $root '.github/workflows/deploy.yml'
$gitignorePath = Join-Path $root '.gitignore'

$deploy = Get-Content -LiteralPath $deployPath -Raw
$gitignore = Get-Content -LiteralPath $gitignorePath

$requiredDeploySnippets = @(
    'PUBLIC_DIR="$RUNNER_TEMP/corner-neighbor-public"',
    '--exclude "node_modules/"',
    '--exclude "_codex_screens/"',
    '--exclude "package.json"',
    '--exclude "package-lock.json"',
    '--exclude "assets/css/custom.dev.css"',
    '--exclude "assets/css/components/"',
    '--exclude "assets/js/ie/"',
    '--exclude "*.py"',
    '"$PUBLIC_DIR/" $XS_USER@$XS_HOST:$XS_REMOTE_DIR'
)

foreach ($snippet in $requiredDeploySnippets) {
    if (-not $deploy.Contains($snippet)) {
        throw "deploy.yml is missing public-artifact safeguard: $snippet"
    }
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
