$ErrorActionPreference = 'Stop'

# Get the path of the repository root, assuming this script is in /scripts
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$baseUrl = "https://hajikkoroom.xsrv.jp"

# Find all HTML files, excluding templates or error pages
$htmlFiles = Get-ChildItem -Path $repoRoot -File -Filter "*.html" | Where-Object { $_.Name -notmatch "^404\.html$" }
$sitemapPath = Join-Path $repoRoot "sitemap.xml"

# Begin constructing the expected sitemap payload.
$xml = '<?xml version="1.0" encoding="UTF-8"?>' + "`n"
$xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "`n"

# In highly secure environments or static generators we might use git commit time, but today's date works best for automated generation on push
$lastmod = (Get-Date).ToString("yyyy-MM-dd")

foreach ($file in $htmlFiles) {
    $filename = $file.Name
    
    # Normally "index.html" implies the root level / of a server
    if ($filename -eq "index.html") {
        $url = "$baseUrl/"
    } else {
        $url = "$baseUrl/$filename"
    }

    $xml += "  <url>`n"
    $xml += "    <loc>$url</loc>`n"
    $xml += "    <lastmod>$lastmod</lastmod>`n"
    $xml += "  </url>`n"
}

$xml += "</urlset>"

# Set the generated XML to the root as sitemap.xml
Set-Content -Path $sitemapPath -Value $xml -Encoding UTF8

Write-Host "✅ sitemap.xml successfully generated at: $sitemapPath"
