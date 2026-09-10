$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$workflowDir = Join-Path $repoRoot '.github/workflows'

if (-not (Test-Path -LiteralPath $workflowDir)) {
    throw "Workflow directory not found: $workflowDir"
}

$workflowFiles = Get-ChildItem -LiteralPath $workflowDir -File |
    Where-Object { $_.Extension -in @('.yml', '.yaml') } |
    Sort-Object FullName

$violations = @()
$remoteActionCount = 0

foreach ($file in $workflowFiles) {
    $lines = Get-Content -LiteralPath $file.FullName
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]
        if ($line -notmatch '^\s*(?:-\s*)?uses:\s*(?<reference>[^\s#]+)') {
            continue
        }

        $reference = $Matches['reference']
        if ($reference.StartsWith('./')) {
            continue
        }

        $remoteActionCount++
        if ($reference -notmatch '^[^@\s]+@[0-9a-fA-F]{40}$') {
            $relativePath = [System.IO.Path]::GetRelativePath($repoRoot, $file.FullName).Replace('\', '/')
            $violations += "${relativePath}:$($index + 1) -> $reference"
        }
    }
}

if ($violations.Count -gt 0) {
    $details = $violations -join [Environment]::NewLine
    throw "Remote GitHub Actions must be pinned to an immutable 40-character commit SHA.$([Environment]::NewLine)$details"
}

Write-Host "GitHub Actions pin policy passed ($remoteActionCount remote action references checked across $($workflowFiles.Count) workflow files)."
