$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'Test-StaticSite.Helpers.ps1')

$repoRoot = Get-RepoRoot
$errors = New-TestErrorList

$invalidChecks = @(
    @{
        Label = 'legacy X URL'
        Pattern = [regex]'https://x\.com/hajikko_games'
    },
    @{
        Label = 'legacy Formspree endpoint'
        Pattern = [regex]'https://formspree\.io/hajikkogurashi\.official@gmail\.com'
    },
    @{
        Label = 'broken strong tag text'
        Pattern = [regex]'E/strong'
    },
    @{
        Label = 'broken breadcrumb closing text'
        Pattern = [regex]'E/li>'
    },
    @{
        Label = 'broken image alt attribute'
        Pattern = [regex]'alt="[^"]*\s*/></span>'
    },
    @{
        Label = 'stray opening angle bracket before paragraph close'
        Pattern = [regex]'<\s+</p>'
    },
    @{
        Label = 'members typo pattern'
        Pattern = [regex]'好っ|描っ方|でっる|生っている|幼っ頃|向っ合い|でっない|抜っで'
    },
    @{
        Label = 'privacy typo pattern'
        Pattern = [regex]'基づっ|困難であるとっ'
    }
)

foreach ($relativePath in (Get-StaticPages)) {
    $fullPath = Join-Path $repoRoot $relativePath
    $content = Get-Content $fullPath -Raw

    foreach ($invalidCheck in $invalidChecks) {
        if ($invalidCheck.Pattern.IsMatch($content)) {
            $errors.Add("Broken content check '$($invalidCheck.Label)' failed in: $relativePath")
        }
    }
}

Write-TestResult -Errors $errors -SuccessMessage "content quality smoke test: ok"
