[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipLint,
    [switch]$SkipUnitTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repoRoot

try {
    Write-Host 'Codex Local Meter VSIX rebuild'
    Write-Host "Repository: $repoRoot"
    Write-Host ''

    if ($Install) {
        Write-Host 'Installing npm dependencies...'
        npm install
        Write-Host ''
    }

    Write-Host 'Compiling TypeScript...'
    npm run compile
    Write-Host ''

    if (-not $SkipLint) {
        Write-Host 'Running lint...'
        npm run lint
        Write-Host ''
    }

    if (-not $SkipUnitTests) {
        Write-Host 'Running unit tests...'
        npm run unit-test
        Write-Host ''
    }

    Write-Host 'Packaging VSIX...'
    npx vsce package
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
