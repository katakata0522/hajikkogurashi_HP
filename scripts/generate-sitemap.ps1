$ErrorActionPreference = 'Stop'

$repoRoot = (Split-Path -Parent $PSScriptRoot)
$baseUrl = 'https://hajikkoroom.xsrv.jp'
$today = (Get-Date).ToString('yyyy-MM-dd')
$excludes = @('404.html')

function Get-Priority {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    switch ($FileName) {
        'index.html'       { return '1.0' }
        'portfolio.html'   { return '0.8' }
        'aboutus.html'     { return '0.8' }
        'news.html'        { return '0.7' }
        'members.html'     { return '0.6' }
        'coming-soon.html' { return '0.5' }
        default            { return '0.4' }
    }
}

$htmlFiles = Get-ChildItem -Path $repoRoot -Filter '*.html' -File |
    Where-Object { $excludes -notcontains $_.Name } |
    Sort-Object Name

$entries = foreach ($file in $htmlFiles) {
    $loc = if ($file.Name -eq 'index.html') {
        "$baseUrl/"
    } else {
        "$baseUrl/$($file.Name)"
    }

    @"
  <url>
    <loc>$loc</loc>
    <lastmod>$today</lastmod>
    <priority>$(Get-Priority -FileName $file.Name)</priority>
  </url>
"@
}

$sitemap = @(
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ($entries -join "`n")
    '</urlset>'
) -join "`n"

$outPath = Join-Path $repoRoot 'sitemap.xml'
[System.IO.File]::WriteAllText($outPath, $sitemap, [System.Text.UTF8Encoding]::new($false))
Write-Output "sitemap.xml generated with $($htmlFiles.Count) URLs -> $outPath"
