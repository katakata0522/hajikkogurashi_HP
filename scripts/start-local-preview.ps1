$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$port = 8000
$serverCommands = @(
    @{ Command = "py"; Arguments = @("-m", "http.server", "$port") },
    @{ Command = "python"; Arguments = @("-m", "http.server", "$port") }
)

foreach ($serverCommand in $serverCommands) {
    if (Get-Command $serverCommand.Command -ErrorAction SilentlyContinue) {
        # Start a simple local server for static-site preview.
        $process = Start-Process -FilePath $serverCommand.Command `
            -ArgumentList $serverCommand.Arguments `
            -WorkingDirectory $repoRoot `
            -PassThru

        Start-Sleep -Seconds 1
        Start-Process "http://localhost:$port/"
        Write-Host "Local preview started: http://localhost:$port/"
        Write-Host "Stop it by ending PID $($process.Id)."
        exit 0
    }
}

throw "Python was not found. Install or enable 'py' or 'python' and try again."
