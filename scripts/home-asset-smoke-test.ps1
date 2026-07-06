$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$rootIndex = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'index.html'), [System.Text.Encoding]::UTF8)
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

if (-not ($rootIndex.Contains('assets/css/index.css?v=<?php') -and $rootIndex.Contains('assets/js/index.js?v=<?php'))) {
    $errors.Add('index.html does not reference the PHP cache-busted assets.')
}

if (-not ($rootIndex.Contains('class="tiles"') -or $rootIndex.Contains('class="tiles '))) {
    $errors.Add('index.html is missing the tiles section.')
}

if (-not ($rootIndex -match 'aria-label="[^"]+"' -and $rootIndex.Contains('>MENU</a>'))) {
    $errors.Add('index.html is missing the menu trigger.')
}

if (-not ($rootIndex -match 'include\s+[\x27\x22]includes/contact-section\.php[\x27\x22]')) {
    $errors.Add('index.html is missing the contact section include.')
}

Write-TestResult -Errors $errors -SuccessMessage 'home asset smoke test: ok'
