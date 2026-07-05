$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$headerPath = Join-Path $repoRoot 'includes\site-header.html'
$footerPath = Join-Path $repoRoot 'includes\site-footer.html'
$contactPath = Join-Path $repoRoot 'includes\contact-section.html'

foreach ($requiredPath in @($headerPath, $footerPath, $contactPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Missing shared section: $requiredPath"
    }
}

$header = Get-Content -LiteralPath $headerPath -Raw -Encoding UTF8
$footer = Get-Content -LiteralPath $footerPath -Raw -Encoding UTF8
$contactTemplate = Get-Content -LiteralPath $contactPath -Raw -Encoding UTF8

$contactReturnTo = @{
    'index.html' = '/'
    'aboutus.html' = '/aboutus.html'
    'portfolio.html' = '/portfolio.html'
}

$htmlFiles = Get-ChildItem -Path $repoRoot -Filter '*.html' -File

foreach ($file in $htmlFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $original = $content

    $content = [regex]::Replace(
        $content,
        '(?s)\s*<!-- Header -->.*?(?=\s*<!-- Banner -->|\s*<!-- Main -->)',
        "`r`n$header`r`n`r`n",
        1
    )

    $content = [regex]::Replace(
        $content,
        '(?s)\s*<!-- Footer -->.*?</footer>',
        "`r`n$footer",
        1
    )

    if ($contactReturnTo.ContainsKey($file.Name)) {
        $returnTo = $contactReturnTo[$file.Name]
        $contact = $contactTemplate -replace 'name="return_to" value="[^"]*"', "name=`"return_to`" value=`"$returnTo`""

        $content = [regex]::Replace(
            $content,
            '(?s)\s*<!-- Contact -->.*?</section>\s*(?=<!-- Footer -->)',
            "`r`n$contact`r`n",
            1
        )
    }

    if ($content -ne $original) {
        Set-Content -LiteralPath $file.FullName -Value $content -NoNewline -Encoding UTF8
    }
}

Write-Host 'shared sections synced'
