[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipLint,
    [switch]$SkipUnitTests,
    [ValidateSet('none', 'patch', 'minor', 'major')]
    [string]$VersionBump = 'none'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repoRoot

function Build-IconFont {
    $iconSource = Join-Path $repoRoot 'images/icon-mono.svg'
    $iconFont = Join-Path $repoRoot 'images/codex-local-meter.woff'
    $generatedRoot = Join-Path $repoRoot 'out/icon-font'
    $generatedSource = Join-Path $generatedRoot 'src'
    $generatedOutput = Join-Path $generatedRoot 'out'

    if (-not (Test-Path -LiteralPath $iconSource)) {
        throw "Icon source not found: $iconSource"
    }

    if (Test-Path -LiteralPath $generatedRoot) {
        Remove-Item -Recurse -Force -LiteralPath $generatedRoot
    }

    New-Item -ItemType Directory -Force -Path $generatedSource, $generatedOutput | Out-Null
    Copy-Item -LiteralPath $iconSource -Destination (Join-Path $generatedSource 'codex-local-meter.svg')

    Invoke-CheckedCommand npx @('svgtofont', '-s', $generatedSource, '-o', $generatedOutput, '-f', 'codex-local-meter')

    $generatedIconFont = Join-Path $generatedOutput 'codex-local-meter.woff'
    if (-not (Test-Path -LiteralPath $generatedIconFont)) {
        throw "Icon font generation completed but no WOFF was found: $generatedIconFont"
    }

    Copy-Item -LiteralPath $generatedIconFont -Destination $iconFont -Force
}

function Build-MarketplaceIcon {
    $iconSource = Join-Path $repoRoot 'images/icon.svg'
    $iconPng = Join-Path $repoRoot 'images/icon.png'

    if (-not (Test-Path -LiteralPath $iconSource)) {
        throw "Marketplace icon source not found: $iconSource"
    }

    Invoke-CheckedCommand npx @('--no-install', '@resvg/resvg-js-cli', $iconSource, $iconPng)

    if (-not (Test-Path -LiteralPath $iconPng)) {
        throw "Marketplace icon generation completed but no PNG was found: $iconPng"
    }
}

function Get-PackageIdentity {
    $packageJsonPath = Join-Path $repoRoot 'package.json'
    $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json

    return [pscustomobject]@{
        Publisher = [string]$packageJson.publisher
        Name = [string]$packageJson.name
        Version = [string]$packageJson.version
    }
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$Arguments = @()
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE."
    }
}

function Get-MarketplaceVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ItemName
    )

    $uri = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'
    $body = @{
        filters = @(
            @{
                criteria = @(
                    @{
                        filterType = 7
                        value = $ItemName
                    }
                )
            }
        )
        flags = 914
    } | ConvertTo-Json -Depth 8

    $response = Invoke-RestMethod `
        -Method Post `
        -Uri $uri `
        -ContentType 'application/json' `
        -Headers @{ Accept = 'application/json;api-version=7.2-preview.1' } `
        -Body $body

    $extension = $response.results[0].extensions[0]
    if ($null -eq $extension -or $null -eq $extension.versions -or $extension.versions.Count -eq 0) {
        throw "Marketplace version not found for $ItemName."
    }

    return [string]$extension.versions[0].version
}

function Get-NextVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseVersion,
        [Parameter(Mandatory = $true)]
        [ValidateSet('patch', 'minor', 'major')]
        [string]$Bump
    )

    $parts = $BaseVersion.Split('.')
    if ($parts.Count -ne 3) {
        throw "Cannot bump non-semver version: $BaseVersion"
    }

    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]

    switch ($Bump) {
        'major' {
            $major += 1
            $minor = 0
            $patch = 0
        }
        'minor' {
            $minor += 1
            $patch = 0
        }
        'patch' {
            $patch += 1
        }
    }

    return "$major.$minor.$patch"
}

try {
    Write-Host 'Codex Local Meter VSIX rebuild'
    Write-Host "Repository: $repoRoot"
    Write-Host ''

    if ($Install) {
        Write-Host 'Installing npm dependencies...'
        Invoke-CheckedCommand npm @('install')
        Write-Host ''
    }

    if ($VersionBump -ne 'none') {
        $identity = Get-PackageIdentity
        $itemName = "$($identity.Publisher).$($identity.Name)"

        Write-Host "Checking Marketplace version for $itemName..."
        $marketplaceVersion = Get-MarketplaceVersion -ItemName $itemName
        Write-Host "Marketplace version: $marketplaceVersion"

        $nextVersion = Get-NextVersion -BaseVersion $marketplaceVersion -Bump $VersionBump
        if ($identity.Version -eq $nextVersion) {
            Write-Host "Local package version is already $nextVersion; skipping npm version."
        } else {
            Write-Host "Bumping package version: $marketplaceVersion -> $nextVersion ($VersionBump)"
            Invoke-CheckedCommand npm @('version', $nextVersion, '--no-git-tag-version')
        }
        Write-Host ''
    }

    Write-Host 'Rebuilding icon font...'
    Build-IconFont
    Write-Host ''

    Write-Host 'Rebuilding marketplace icon...'
    Build-MarketplaceIcon
    Write-Host ''

    Write-Host 'Compiling TypeScript...'
    Invoke-CheckedCommand npm @('run', 'compile')
    Write-Host ''

    if (-not $SkipLint) {
        Write-Host 'Running lint...'
        Invoke-CheckedCommand npm @('run', 'lint')
        Write-Host ''
    }

    if (-not $SkipUnitTests) {
        Write-Host 'Running unit tests...'
        Invoke-CheckedCommand npm @('run', 'unit-test')
        Write-Host ''
    }

    Write-Host 'Packaging VSIX...'
    Invoke-CheckedCommand npx @('vsce', 'package')
    Write-Host ''

    $package = Get-ChildItem -Path $repoRoot -Filter '*.vsix' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -eq $package) {
        throw 'Packaging completed but no .vsix file was found.'
    }

    Write-Host "Built: $($package.FullName)"
} finally {
    Pop-Location
}
