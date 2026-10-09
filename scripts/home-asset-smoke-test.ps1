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

if (-not ($rootIndex -match 'assets/css/index\.css\?v=[^"]+' -and $rootIndex -match 'assets/js/index\.js\?v=[^"]+')) {
    $errors.Add('index.html does not reference the versioned home assets.')
}

if ($rootIndex -match 'file_get_contents|simplexml_load_string') {
    $errors.Add('index.html still contains runtime RSS PHP that can leak into static previews.')
}

if (-not ($rootIndex.Contains('class="tiles"') -or $rootIndex.Contains('class="tiles '))) {
    $errors.Add('index.html is missing the tiles section.')
}

# 共通ナビ（PR #52 から取り込み）: ボタンのメニュー切り替えと、最初は操作できない状態のメニュー
if ($rootIndex -notmatch '<button\b[^>]*class="menu-toggle"[^>]*aria-controls="mobile-menu"[^>]*aria-expanded="false"') {
    $errors.Add('index.html is missing the menu trigger.')
}
if ($rootIndex -notmatch '<nav\b[^>]*class="mobile-menu"[^>]*\bid="mobile-menu"[^>]*\binert\b') {
    $errors.Add('index.html mobile menu must begin inert.')
}

if (-not ($rootIndex -match 'include\s+[\x27\x22]includes/contact-section\.php[\x27\x22]')) {
    $errors.Add('index.html is missing the contact section include.')
}

Write-TestResult -Errors $errors -SuccessMessage 'home asset smoke test: ok'
