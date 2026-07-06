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

function Escape-HtmlAttribute {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [System.Net.WebUtility]::HtmlEncode($Value)
}

function Set-MinigameSeoBlock {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$Image
    )

    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path $path)) {
        Write-Warning "SEO対象ファイルが見つかりません: $RelativePath"
        return
    }

    $urlPath = ($RelativePath -replace '/index\.html$', '/')
    $canonical = "$baseUrl/$urlPath"
    $imageUrl = if ($Image -match '^https?://') { $Image } else { "$baseUrl/$Image" }

    $safeTitle = Escape-HtmlAttribute $Title
    $safeDescription = Escape-HtmlAttribute $Description
    $safeCanonical = Escape-HtmlAttribute $canonical
    $safeImage = Escape-HtmlAttribute $imageUrl

    $seoBlock = @"
    <!-- SEO: hajikkogurashi-minigame -->
    <meta name="description" content="$safeDescription">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="$safeCanonical">
    <meta property="og:locale" content="ja_JP">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Corner Neighbor">
    <meta property="og:title" content="$safeTitle">
    <meta property="og:description" content="$safeDescription">
    <meta property="og:url" content="$safeCanonical">
    <meta property="og:image" content="$safeImage">
    <meta property="og:image:alt" content="$safeTitle">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="$safeTitle">
    <meta name="twitter:description" content="$safeDescription">
    <meta name="twitter:image" content="$safeImage">
    <!-- /SEO: hajikkogurashi-minigame -->
"@

    $html = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $markerPattern = '(?s)\s*<!-- SEO: hajikkogurashi-minigame -->.*?<!-- /SEO: hajikkogurashi-minigame -->'

    if ($html -match $markerPattern) {
        $html = [regex]::Replace($html, $markerPattern, "`n$seoBlock")
    } elseif ($html -match '(?is)<title>.*?</title>') {
        $html = [regex]::Replace($html, '(?is)(<title>.*?</title>)', "`$1`n$seoBlock", 1)
    } else {
        Write-Warning "titleタグが見つからないためSEOメタを挿入できません: $RelativePath"
        return
    }

    [System.IO.File]::WriteAllText($path, $html, [System.Text.UTF8Encoding]::new($false))
    Write-Output "SEO metadata injected -> $RelativePath"
}

# 1. ルート直下のHTMLファイルを処理
$htmlFiles = Get-ChildItem -Path $repoRoot -Filter '*.html' -File |
    Where-Object { $excludes -notcontains $_.Name } |
    Sort-Object Name

$entries = New-Object System.Collections.Generic.List[string]

foreach ($file in $htmlFiles) {
    $loc = if ($file.Name -eq 'index.html') {
        "$baseUrl/"
    } else {
        "$baseUrl/$($file.Name)"
    }

    $entries.Add(@"
  <url>
    <loc>$loc</loc>
    <lastmod>$today</lastmod>
    <priority>$(Get-Priority -FileName $file.Name)</priority>
  </url>
"@)
}

# 2. ミニゲーム等のサブディレクトリを処理
# index.html を含み、システム/アセット系以外の非隠しフォルダを自動検出
$systemDirs = @('assets', 'includes', 'scripts')
$subDirs = Get-ChildItem -Path $repoRoot -Directory |
    Where-Object { 
        $systemDirs -notcontains $_.Name -and 
        $_.Name -notmatch '^\.' -and
        (Test-Path (Join-Path $_.FullName 'index.html'))
    } |
    Sort-Object Name

foreach ($dir in $subDirs) {
    $loc = "$baseUrl/$($dir.Name)/"
    $entries.Add(@"
  <url>
    <loc>$loc</loc>
    <lastmod>$today</lastmod>
    <priority>0.5</priority>
  </url>
"@)
}

$sitemap = @(
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ($entries -join "`n")
    '</urlset>'
) -join "`n"

$outPath = Join-Path $repoRoot 'sitemap.xml'
[System.IO.File]::WriteAllText($outPath, $sitemap, [System.Text.UTF8Encoding]::new($false))
Write-Output "sitemap.xml generated with $($entries.Count) URLs -> $outPath"

$minigamePages = @(
    @{ Path = 'blackhole-sweeper/index.html'; Title = 'ブラックホール・スイーパー | Corner Neighbor'; Description = '線でバグを囲んで一網打尽にする、スマホ対応の一筆書きアクションゲームです。Corner Neighborのブラウザミニゲームとして公開中。'; Image = '/assets/images/blackhole_sweeper_thumbnail_1779194532152.png' },
    @{ Path = 'girigiri-brake/index.html'; Title = 'ギリギリ・ブレーキ！ | Corner Neighbor'; Description = '猛スピードから急ブレーキして崖ギリギリを狙う、スマホ対応のチキンレース系ミニゲームです。'; Image = '/assets/images/girigiri_brake_thumbnail_1779165077904.png' },
    @{ Path = 'kage-mane-dojo/index.html'; Title = '影まね道場 | Corner Neighbor'; Description = 'お題の影や形を見極めて遊ぶ、Corner Neighbor制作のブラウザミニゲームです。'; Image = '/assets/images/banner.webp' },
    @{ Path = 'kanji-slicer/index.html'; Title = '漢字スライサー・マージ | Corner Neighbor'; Description = '落ちてくる漢字をスワイプで斬り、部首を合体させてお題をクリアするスマホ対応の物理スライスアクションです。'; Image = '/assets/images/kanji_slicer_thumbnail.png' },
    @{ Path = 'lumen-mirror/index.html'; Title = 'LUMEN_MIRROR | Corner Neighbor'; Description = '鏡のラインを描いて光をターゲットへ導く、幾何学的な物理反射パズルゲームです。'; Image = '/assets/images/lumen_mirror_thumbnail.png' },
    @{ Path = 'mikiri-issen/index.html'; Title = '見切り一閃 | Corner Neighbor'; Description = 'タイミングを見極めて一閃を決める、Corner Neighbor制作のブラウザミニゲームです。'; Image = '/assets/images/banner.webp' },
    @{ Path = 'sorting-factory/index.html'; Title = '超絶！仕分け工場 | Corner Neighbor'; Description = '迫り来るアイテムを左右に仕分ける、ルール変化が楽しいスマホ対応の脳トレパニックゲームです。'; Image = '/assets/images/sorting_factory_thumbnail_1779165097756.png' },
    @{ Path = 'stealth-slacker/index.html'; Title = '限界！ステルスサボタージュ | Corner Neighbor'; Description = '上司にバレないように全力でサボる、スマホ対応のコミカルなバカゲー系ミニゲームです。'; Image = '/assets/images/stealth_slacker_thumbnail_1779165112569.png' },
    @{ Path = 'wall-jumper/index.html'; Title = 'ウォールジャンパー | Corner Neighbor'; Description = '壁を使って跳び回る、Corner Neighbor制作のブラウザアクションミニゲームです。'; Image = '/assets/images/banner.webp' }
)

foreach ($page in $minigamePages) {
    Set-MinigameSeoBlock -RelativePath $page.Path -Title $page.Title -Description $page.Description -Image $page.Image
}
