$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$readme = Get-Content (Join-Path $repoRoot "README.md") -Raw
$rootIndex = Get-Content (Join-Path $repoRoot "index.html") -Raw

$retiredPaths = @(
    "_config.yml",
    "_includes",
    "_layouts",
    "_posts",
    "_sass",
    "_backups",
    ".bundle",
    "vendor",
    "404.md",
    "aboutus.md",
    "coming-soon.md",
    "members.md",
    "news.md",
    "portfolio.md",
    "privacy-policy.md",
    "terms-of-service.md",
    "Gemfile",
    "forty_jekyll_theme.gemspec",
    "config_backup_from_root.yml",
    "scripts\sync-static-mirror.ps1",
    "assets\css\main.scss",
    "assets\css\index.scss",
    "assets\css\ie8.scss",
    "assets\css\ie9.scss",
    "assets\css\index-20260307-4.css",
    "assets\css\index-20260307-5.css"
)

$requiredPaths = @(
    ".nojekyll",
    "README.md",
    "assets",
    "scripts",
    "scripts\start-local-preview.ps1",
    "scripts\local-reference-check.ps1",
    "scripts\Test-StaticSite.Helpers.ps1"
)

$errors = New-TestErrorList

foreach ($relativePath in $retiredPaths) {
    if (Test-Path (Join-Path $repoRoot $relativePath)) {
        $errors.Add("Retired Jekyll artifact still exists: $relativePath")
    }
}

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path (Join-Path $repoRoot $relativePath))) {
        $errors.Add("Required static-site file is missing: $relativePath")
    }
}

if (-not ($readme.Contains('HTML + CSS + JavaScript') -and $readme.Contains('index.html') -and $readme.Contains('start-local-preview.ps1') -and $readme.Contains('local-reference-check.ps1'))) {
    $errors.Add("README.md does not describe the static-site workflow.")
}

if (-not ($rootIndex.Contains('<link rel="canonical" href="https://hajikkoroom.xsrv.jp/" />') -and $rootIndex.Contains('twitter:card'))) {
    $errors.Add("index.html is missing the expected baseline SEO tags.")
}

Write-TestResult -Errors $errors -SuccessMessage "structure smoke test: ok"
