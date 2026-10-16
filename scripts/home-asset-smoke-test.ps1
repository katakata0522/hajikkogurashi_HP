$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$rootIndex = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'index.html'), [System.Text.Encoding]::UTF8)
$indexCssPath = Join-Path $repoRoot 'assets\css\index.css'
$indexJsPath = Join-Path $repoRoot 'assets\js\index.js'

$errors = New-TestErrorList

if (-not (Test-Path $indexCssPath)) {
    $errors.Add('Missing legacy home-only CSS file.')
}

if (-not (Test-Path $indexJsPath)) {
    $errors.Add('Missing legacy home-only JS file.')
}

if (Test-ContainsLiquidSyntax -Content $rootIndex) {
    $errors.Add('index.html still contains Liquid syntax.')
}

if ($rootIndex -match 'file_get_contents|simplexml_load_string') {
    $errors.Add('index.html still contains runtime RSS PHP that can leak into static previews.')
}

if (-not ($rootIndex.Contains('<link rel="canonical" href="https://hajikkoroom.xsrv.jp/" />') -and $rootIndex.Contains('twitter:card'))) {
    $errors.Add('index.html is missing baseline SEO/OGP tags.')
}

if (-not ($rootIndex.Contains('data-nav="top"') -and $rootIndex.Contains('data-nav="games"'))) {
    $errors.Add('index.html is missing the main navigation links.')
}

if (-not ($rootIndex.Contains('ue5-flagship-card') -or $rootIndex.Contains('id="flagship"'))) {
    $errors.Add('index.html is missing the flagship games showcase.')
}

if (-not ($rootIndex.Contains('id="arcade"') -or $rootIndex.Contains('minigame'))) {
    $errors.Add('index.html is missing the minigames showcase.')
}

if (-not ($rootIndex.Contains('id="dispatch"') -or $rootIndex.Contains('transmission-panel'))) {
    $errors.Add('index.html is missing the dispatch/contact section.')
}

Write-TestResult -Errors $errors -SuccessMessage 'home asset smoke test: ok'
