$ErrorActionPreference = 'Stop'

$workflowPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.github/workflows/deploy.yml'))
$retryHelperPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.github/scripts/rsync-transient-retry.sh'))

foreach ($path in @($workflowPath, $retryHelperPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Deploy security input not found: $path"
    }
}

$content = Get-Content -LiteralPath $workflowPath -Raw
$retryHelper = Get-Content -LiteralPath $retryHelperPath -Raw

$requiredOnce = @(
    'persist-credentials: false',
    'cancel-in-progress: false',
    '- name: Detect deployment impact',
    'deploy_needed=',
    '- name: Skip production deployment',
    'No public artifact or deploy-time build input changed; Xserver deployment is skipped.',
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

# workflow_dispatchはmain以外のrefでも起動できるため、本番deploy jobで明示的に拒否する。
$mainOnlyDeployJob = "(?m)^  deploy:\r?\n    if: github\.ref == 'refs/heads/main'\r?\n    runs-on: ubuntu-latest\r?$"
if ($content -notmatch $mainOnlyDeployJob) {
    throw 'Production deploy job must reject non-main workflow_dispatch refs.'
}

foreach ($pattern in $requiredOnce) {
    if (-not $content.Contains($pattern)) {
        throw "Required deploy security setting is missing: $pattern"
    }
}

$requiredForMainRsyncStep = @(
    'source .github/scripts/rsync-transient-retry.sh',
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

foreach ($pattern in $requiredForMainRsyncStep) {
    $count = ([regex]::Matches($content, [regex]::Escape($pattern))).Count
    if ($count -ne 1) {
        throw "SSH hardening must cover the single main-site rsync path: $pattern (found $count)"
    }
}

if (([regex]::Matches($content, [regex]::Escape("if: steps.changes.outputs.deploy_needed == 'true'"))).Count -lt 6) {
    throw 'Production steps are not consistently gated by deploy impact.'
}

$retryRequirements = @(
    '10|12|30|35|255',
    'is_transient_network_exit_code',
    'run_with_transient_retry',
    'non-transient exit code',
    'retrying in ${delay}s'
)
foreach ($pattern in $retryRequirements) {
    if (-not $retryHelper.Contains($pattern)) {
        throw "Transient-only retry guard is missing: $pattern"
    }
}

$forbidden = @(
    'playpoint-sim.com',
    'kanji_slicer_changed',
    'StrictHostKeyChecking=accept-new',
    'ssh-keyscan',
    '~/.ssh/id_rsa',
    'rsync attempt $attempt failed with status $status; retrying'
)

foreach ($pattern in $forbidden) {
    if ($content.Contains($pattern) -or $retryHelper.Contains($pattern)) {
        throw "Forbidden legacy deploy behavior remains: $pattern"
    }
}

Write-Host 'Deploy SSH/security/impact smoke test passed.'
