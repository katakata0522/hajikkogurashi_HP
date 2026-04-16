$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$errors = New-TestErrorList
$htmlFiles = Get-ChildItem -Path $repoRoot -Filter *.html -File

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $contentWithoutComments = Get-ContentWithoutHtmlComments -Content $content
    $referenceMatches = [regex]::Matches($contentWithoutComments, '(?i)(?:href|src)="([^"]+)"')

    foreach ($match in $referenceMatches) {
        $reference = $match.Groups[1].Value

        if (
            $reference.StartsWith('http://') -or
            $reference.StartsWith('https://') -or
            $reference.StartsWith('mailto:') -or
            $reference.StartsWith('tel:') -or
            $reference.StartsWith('#') -or
            $reference.StartsWith('data:')
        ) {
            continue
        }

        $pathPart = $reference.Split('?')[0].Split('#')[0]
        if ([string]::IsNullOrWhiteSpace($pathPart)) {
            continue
        }

        if ($pathPart.StartsWith('/')) {
            $targetPath = Join-Path $repoRoot $pathPart.TrimStart('/')
        }
        else {
            $targetPath = Join-Path $file.DirectoryName $pathPart
        }

        if (-not (Test-Path -LiteralPath $targetPath)) {
            $errors.Add("Broken local reference in $($file.Name): $reference")
        }
    }

    $blankTargetMatches = [regex]::Matches($contentWithoutComments, '(?is)<a\b[^>]*target="_blank"[^>]*>')
    foreach ($match in $blankTargetMatches) {
        if ($match.Value -notmatch 'rel="[^"]*noopener[^"]*"') {
            $errors.Add("Missing rel=noopener on target=_blank link in $($file.Name)")
        }
    }
}

Write-TestResult -Errors $errors -SuccessMessage "local reference check: ok"
