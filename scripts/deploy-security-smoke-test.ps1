$ErrorActionPreference = 'Stop'

$workflowPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.github/workflows/deploy.yml'))
if (-not (Test-Path -LiteralPath $workflowPath)) {
    throw "Deploy workflow not found: $workflowPath"
}

$content = Get-Content -LiteralPath $workflowPath -Raw

$requiredOnce = @(
    'persist-credentials: false',
    'umask 077',
    'chmod 700 ~/.ssh',
    'chmod 600 ~/.ssh/id_deploy',
    'ssh-keygen -y -P',
    '[hajikkoroom.xsrv.jp]:10022 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEKKSe2ENjD1KRgSqCY7ji78s0zqCNCKBRNfRaxRV7sh',
    'chmod 600 ~/.ssh/known_hosts',
    'Unexpected Xserver SSH endpoint; refusing to use an unpinned host.',
    '- name: Remove SSH material',
    'rm -f ~/.ssh/id_deploy ~/.ssh/known_hosts'
)

foreach ($pattern in $requiredOnce) {
    if (-not $content.Contains($pattern)) {
        throw "Required deploy security setting is missing: $pattern"
    }
}

$requiredForBothRsyncSteps = @(
    'BatchMode=yes',
    'IdentitiesOnly=yes',
    'PubkeyAuthentication=yes',
    'PreferredAuthentications=publickey',
    'PasswordAuthentication=no',
    'KbdInteractiveAuthentication=no',
    'ForwardAgent=no',
    'ClearAllForwardings=yes',
    'RequestTTY=no',
    'StrictHostKeyChecking=yes',
    'UserKnownHostsFile=$HOME/.ssh/known_hosts',
    'LogLevel=ERROR'
)

foreach ($pattern in $requiredForBothRsyncSteps) {
    $count = ([regex]::Matches($content, [regex]::Escape($pattern))).Count
    if ($count -lt 2) {
        throw "SSH hardening must cover both rsync paths: $pattern (found $count)"
    }
}

$forbidden = @(
    'StrictHostKeyChecking=accept-new',
    'ssh-keyscan',
    '~/.ssh/id_rsa'
)

foreach ($pattern in $forbidden) {
    if ($content.Contains($pattern)) {
        throw "Forbidden legacy SSH behavior remains: $pattern"
    }
}

Write-Host 'Deploy SSH security smoke test passed.'
