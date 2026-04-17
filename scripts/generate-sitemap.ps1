#!/usr/bin/env pwsh
# ============================================================
# generate-sitemap.ps1
# リポジトリ内の全 HTML ファイルから sitemap.xml を自動生成する
# ============================================================
$ErrorActionPreference = 'Stop'

$repoRoot  = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
$baseUrl   = 'https://hajikkoroom.xsrv.jp'
$today     = (Get-Date).ToString('yyyy-MM-dd')

# 除外対象（検索エンジンに登録しないページ）
$excludes = @('404.html')

# HTML ファイルを収集
$htmlFiles = Get-ChildItem -Path $repoRoot -Filter '*.html' -File |
    Where-Object { $excludes -notcontains $_.Name }

# 優先度の定義（トップページは最重要、他はやや低め）
function Get-Priority($fileName) {
    switch ($fileName) {
        'index.html'          { '1.0' }
        'portfolio.html'      { '0.8' }
        'aboutus.html'        { '0.8' }
        'news.html'           { '0.7' }
        'members.html'        { '0.6' }
        'coming-soon.html'    { '0.5' }
        default               { '0.4' }
    }
}

# sitemap.xml を組み立て
$entries = foreach ($file in $htmlFiles) {
    $loc = if ($file.Name -eq 'index.html') {
        "$baseUrl/"
    } else {
        "$baseUrl/$($file.Name)"
    }
    $priority = Get-Priority $file.Name

    @"
  <url>
    <loc>$loc</loc>
    <lastmod>$today</lastmod>
    <priority>$priority</priority>
  </url>
"@
}

$sitemap = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
$($entries -join "`n")
</urlset>
"@

$outPath = Join-Path $repoRoot 'sitemap.xml'
$sitemap | Out-File -FilePath $outPath -Encoding utf8NoBOM -Force
Write-Output "sitemap.xml generated with $($htmlFiles.Count) URLs -> $outPath"
