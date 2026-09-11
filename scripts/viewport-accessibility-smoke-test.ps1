$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$htmlFiles = @(git -C $root ls-files -- '*.html')
if ($LASTEXITCODE -ne 0) {
    throw 'git ls-files failed while collecting HTML files'
}
if ($htmlFiles.Count -eq 0) {
    throw 'No tracked HTML files found for viewport accessibility audit'
}

$checked = 0
$violations = [System.Collections.Generic.List[string]]::new()

foreach ($relativePath in $htmlFiles) {
    $path = Join-Path $root $relativePath
    $source = Get-Content -LiteralPath $path -Raw
    $viewportMatches = [regex]::Matches(
        $source,
        '<meta\b(?=[^>]*\bname\s*=\s*["'']viewport["''])[^>]*>',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    foreach ($match in $viewportMatches) {
        $checked++
        $tag = $match.Value
        if ($tag -match '(?i)user-scalable\s*=\s*no') {
            $violations.Add("${relativePath}: viewport disables user scaling")
        }
        if ($tag -match '(?i)maximum-scale\s*=') {
            $violations.Add("${relativePath}: viewport caps maximum zoom")
        }
    }
}

if ($checked -eq 0) {
    throw 'No viewport meta tags found in tracked HTML files'
}
if ($violations.Count -gt 0) {
    throw "Viewport accessibility violations:`n$($violations -join "`n")"
}

Write-Host "viewport accessibility smoke test: ok ($checked viewport tags across $($htmlFiles.Count) HTML files)"
