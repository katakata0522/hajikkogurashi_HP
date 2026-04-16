$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$errors = New-TestErrorList

foreach ($relativePath in (Get-StaticPages)) {
    $fullPath = Join-Path $repoRoot $relativePath

    if (-not (Test-Path $fullPath)) {
        $errors.Add("Missing static page: $relativePath")
        continue
    }

    $content = Get-Content $fullPath -Raw

    if (Test-ContainsLiquidSyntax -Content $content) {
        $errors.Add("Static page still contains Liquid syntax: $relativePath")
    }

    if (-not $content.Contains('<html lang="ja">')) {
        $errors.Add("Missing lang=ja in: $relativePath")
    }
}

foreach ($relativePath in (Get-StaticAssets)) {
    if (-not (Test-Path (Join-Path $repoRoot $relativePath))) {
        $errors.Add("Missing static asset: $relativePath")
    }
}

Write-TestResult -Errors $errors -SuccessMessage "static site smoke test: ok"
