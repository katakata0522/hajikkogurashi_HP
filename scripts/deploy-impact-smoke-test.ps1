$ErrorActionPreference = 'Stop'

$classifierPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.github/scripts/detect-deploy-impact.cjs'))
if (-not (Test-Path -LiteralPath $classifierPath)) {
    throw "Deploy impact classifier not found: $classifierPath"
}

function Invoke-Classifier([string[]] $Paths) {
    $inputText = ($Paths -join "`n") + "`n"
    $output = $inputText | node $classifierPath
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy impact classifier exited with code $LASTEXITCODE"
    }
    return ($output | Out-String | ConvertFrom-Json)
}

$deployCases = @(
    'index.html',
    'assets/css/custom.css',
    'kanji-slicer/index.html',
    'scripts/generate-sitemap.ps1',
    '.github/workflows/deploy.yml',
    '.\assets\css\custom.css'
)

foreach ($path in $deployCases) {
    $result = Invoke-Classifier @($path)
    if (-not $result.deployNeeded) {
        throw "Expected deploy impact but classifier ignored: $path"
    }
}

$ignoredCases = @(
    'README.md',
    'package-lock.json',
    'scripts/static-site-smoke-test.ps1',
    'scripts/deploy-security-smoke-test.ps1',
    '.github/workflows/link-checker.yml',
    '.github/scripts/rsync-transient-retry.sh',
    'assets/css/custom.dev.css',
    'assets/css/components/button.css',
    'assets/js/ie/legacy.js',
    'tools.py'
)

foreach ($path in $ignoredCases) {
    $result = Invoke-Classifier @($path)
    if ($result.deployNeeded) {
        throw "Expected non-public change but classifier requested deploy: $path"
    }
}

$mixed = Invoke-Classifier @('scripts/static-site-smoke-test.ps1', 'index.html')
if (-not $mixed.deployNeeded) {
    throw 'A public change mixed with quality-only changes must deploy.'
}

$unsafe = Invoke-Classifier @('../outside.txt')
if (-not $unsafe.deployNeeded) {
    throw 'Untrusted relative paths must fail safe toward deploy.'
}

Write-Host 'Deploy impact classifier smoke test passed.'
