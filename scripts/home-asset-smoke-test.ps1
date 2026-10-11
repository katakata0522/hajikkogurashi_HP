$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$index = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'index.html'), [System.Text.Encoding]::UTF8)
$cssFile = Join-Path $repoRoot 'assets/css/home-v2.css'
$jsFile = Join-Path $repoRoot 'assets/js/site-navigation.js'
$errors = New-TestErrorList

foreach ($asset in @($cssFile, $jsFile)) {
    if (-not (Test-Path -LiteralPath $asset)) {
        $errors.Add("Missing V2 home asset: $asset")
    }
}

if (Test-ContainsLiquidSyntax -Content $index) {
    $errors.Add('Homepage must not contain Liquid templates')
}
if ($index -match 'file_get_contents|simplexml_load_string|<\?php') {
    $errors.Add('Homepage must render without server-side PHP')
}

$cssReference = [regex]::Match($index, '<link\b[^>]*\bhref="/assets/css/home-v2\.css\?v=([A-Za-z0-9._-]+)"')
$jsReference = [regex]::Match($index, '<script\b[^>]*\bsrc="/assets/js/site-navigation\.js\?v=([A-Za-z0-9._-]+)"')
if (-not $cssReference.Success -or -not $jsReference.Success) {
    $errors.Add('V2 homepage must reference versioned external CSS and JS')
}
foreach ($asset in @(@{ File=$cssFile; Reference=$cssReference }, @{ File=$jsFile; Reference=$jsReference })) {
    if ((Test-Path -LiteralPath $asset.File) -and $asset.Reference.Success) {
        $digest = (Get-FileHash -LiteralPath $asset.File -Algorithm SHA256).Hash.Substring(0,12).ToLowerInvariant()
        if ($asset.Reference.Groups[1].Value -ne $digest) { $errors.Add("Stale content version: $($asset.File)") }
    }
}

if ([regex]::Matches($index, '<h1\b', 'IgnoreCase').Count -ne 1) {
    $errors.Add('Homepage must contain exactly one main heading')
}

foreach ($section in @('main','about','works','play','journal','people','contact')) {
    if ($index -notmatch ('(?i)\bid="' + $section + '"')) {
        $errors.Add("Missing homepage section: $section")
    }
}
foreach ($path in @('/portfolio.html','/minigames.html','/news.html','/members.html','/privacy-policy.html','/terms-of-service.html')) {
    if (-not $index.Contains('href="' + $path + '"')) {
        $errors.Add("Missing local site navigation: $path")
    }
}

if ($index -notmatch '<button\b[^>]*class="menu-toggle"[^>]*aria-controls="mobile-menu"[^>]*aria-expanded="false"') {
    $errors.Add('Accessible mobile menu trigger is missing')
}
if ($index -notmatch '<nav\b[^>]*class="mobile-menu"[^>]*\bid="mobile-menu"[^>]*\binert\b') {
    $errors.Add('Mobile menu must begin inert for keyboard navigation')
}
if ($index -notmatch 'href="mailto:[^"]+"') {
    $errors.Add('Contact section must contain a working email link')
}
if ($index -notmatch '<link rel="canonical" href="https://hajikkoroom\.xsrv\.jp/" ?/>') {
    $errors.Add('Homepage canonical URL must match official origin')
}
if ($index -match '(?i)逃亡おじさん|V2 CONCEPT') {
    $errors.Add('Unverified concept-stage text must not be shipped')
}

if (Test-Path -LiteralPath $cssFile) {
    $css = [System.IO.File]::ReadAllText($cssFile, [System.Text.Encoding]::UTF8)
    if ($css -notmatch '@media' -or $css -notmatch 'prefers-reduced-motion') {
        $errors.Add('Responsive and reduced-motion CSS are required')
    }
}
if (Test-Path -LiteralPath $jsFile) {
    $js = [System.IO.File]::ReadAllText($jsFile, [System.Text.Encoding]::UTF8)
    if ($js -notmatch 'aria-expanded' -or $js -notmatch 'Escape' -or $js -notmatch 'restoreFocus') {
        $errors.Add('Mobile menu must manage focus and Escape-key closing')
    }
}

Write-TestResult -Errors $errors -SuccessMessage 'home V2 asset and structure smoke test: ok'
