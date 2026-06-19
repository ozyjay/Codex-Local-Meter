param(
    [ValidateSet('none', 'patch', 'minor', 'major')]
    [string]$VersionBump = 'none'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE: $FilePath $($Arguments -join ' ')"
    }
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')

Push-Location $repoRoot
try {
    $packageJson = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
    $publisher = [string]$packageJson.publisher
    $packageName = [string]$packageJson.name
    $itemName = "$publisher.$packageName"

    Write-Host 'Codex Local Meter Marketplace publish'
    Write-Host "Repository: $repoRoot"
    Write-Host "Marketplace item: $itemName"
    Write-Host "Version bump: $VersionBump"
    Write-Host ''

    if ($VersionBump -eq 'none') {
        Invoke-CheckedCommand npm @('run', 'package:vsix')
    } else {
        Invoke-CheckedCommand npm @('run', "package:$VersionBump")
    }

    $packagePath = Get-ChildItem -LiteralPath $repoRoot -Filter '*.vsix' -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -eq $packagePath) {
        throw 'Packaging completed but no .vsix file was found.'
    }

    Write-Host ''
    Write-Host "Publishing: $($packagePath.FullName)"
    Invoke-CheckedCommand npx @('vsce', 'publish', '--packagePath', $packagePath.FullName)

    Write-Host ''
    Write-Host 'Verifying published extension...'
    Invoke-CheckedCommand npx @('vsce', 'show', $itemName)

    Write-Host ''
    Write-Host "Published: $itemName"
} finally {
    Pop-Location
}
