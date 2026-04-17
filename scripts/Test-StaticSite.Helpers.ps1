$script:StaticPages = @(
    "404.html",
    "aboutus.html",
    "coming-soon.html",
    "index.html",
    "members.html",
    "news.html",
    "portfolio.html",
    "privacy-policy.html",
    "terms-of-service.html"
)

$script:StaticAssets = @(
    "assets\css\main.css",
    "assets\css\custom.css",
    "assets\css\members.css",
    "assets\css\index.css",
    "assets\css\portfolio.css",
    "assets\js\main.js",
    "assets\js\index.js"
)

function Get-RepoRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

function Get-StaticPages {
    return @($script:StaticPages)
}

function Get-StaticAssets {
    return @($script:StaticAssets)
}

function New-TestErrorList {
    return ,(New-Object System.Collections.Generic.List[string])
}

function Test-ContainsLiquidSyntax {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    return $Content.Contains("{{") -or $Content.Contains("{%")
}

function Get-ContentWithoutHtmlComments {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    # Ignore stale links that only exist inside HTML comments.
    return [regex]::Replace($Content, '<!--.*?-->', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)
}

function Write-TestResult {
    param(
        [AllowEmptyCollection()]
        [Parameter(Mandatory = $true)]
        [System.Collections.Generic.List[string]]$Errors,
        [Parameter(Mandatory = $true)]
        [string]$SuccessMessage
    )

    if ($Errors.Count -gt 0) {
        $Errors | ForEach-Object { Write-Error $_ }
        exit 1
    }

    Write-Host $SuccessMessage
}
