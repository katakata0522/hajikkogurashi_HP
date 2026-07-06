$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

$srcFile = Join-Path $repoRoot "assets/css/custom.dev.css"
$destFile = Join-Path $repoRoot "assets/css/custom.css"
$cssDir = Join-Path $repoRoot "assets/css"

Write-Host "Bundling CSS from custom.dev.css to custom.css..."

if (-not (Test-Path $srcFile)) {
    throw "Source file not found: $srcFile"
}

$content = Get-Content -Raw -Path $srcFile

# Regex to match @import url("./components/something.css");
$importRegex = '@import\s+url\(["'']([^"'']+)["'']\);?'

$matches = [regex]::Matches($content, $importRegex)

# Loop in reverse order to replace text from bottom to top without breaking character offsets
for ($i = $matches.Count - 1; $i -ge 0; $i--) {
    $match = $matches[$i]
    $relativePath = $match.Groups[1].Value
    
    # We only inline local files (relative paths starting with ./ or components/)
    if ($relativePath.StartsWith("./") -or $relativePath.StartsWith("components/")) {
        $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($cssDir, $relativePath))
        if (Test-Path $fullPath) {
            Write-Host "Inlining: $relativePath"
            $importedContent = Get-Content -Raw -Path $fullPath
            
            # Replace the @import line with the imported file content
            $content = $content.Substring(0, $match.Index) + $importedContent + $content.Substring($match.Index + $match.Length)
        } else {
            Write-Warning "Import file not found: $fullPath"
        }
    }
}

# Write bundled CSS
[System.IO.File]::WriteAllText($destFile, $content, [System.Text.Encoding]::UTF8)
Write-Host "CSS Bundling completed successfully!"
