$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$rootIndex = Get-Content (Join-Path $repoRoot 'index.html') -Raw -Encoding UTF8
$indexCssPath = Join-Path $repoRoot 'assets\css\index.css'
$indexJsPath = Join-Path $repoRoot 'assets\js\index.js'

$errors = New-TestErrorList

if (-not (Test-Path $indexCssPath)) {
    $errors.Add('Missing home-only CSS file.')
}

if (-not (Test-Path $indexJsPath)) {
    $errors.Add('Missing home-only JS file.')
}

if (Test-ContainsLiquidSyntax -Content $rootIndex) {
    $errors.Add('index.html still contains Liquid syntax.')
}

if (-not ($rootIndex.Contains('assets/css/index.css?v=20260705') -and $rootIndex.Contains('assets/js/index.js?v=20260705'))) {
    $errors.Add('index.html does not reference the versioned home assets.')
}

if (-not ($rootIndex.Contains('class="tiles"') -or $rootIndex.Contains('class="tiles '))) {
    $errors.Add('index.html is missing the tiles section.')
}

if (-not ($rootIndex.Contains('href="#menu"') -and $rootIndex.Contains('>MENU</a>'))) {
    $errors.Add('index.html is missing the menu trigger.')
}

if (-not ($rootIndex.Contains('<section id="contact">') -and $rootIndex.Contains('name="return_to" value="/"'))) {
    $errors.Add('index.html is missing the static contact section.')
}

Write-TestResult -Errors $errors -SuccessMessage 'home asset smoke test: ok'
