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

    npx svgtofont -s $generatedSource -o $generatedOutput -f codex-local-meter
    if ($LASTEXITCODE -ne 0) {
        throw "Icon font generation failed with exit code $LASTEXITCODE."
    }

    $generatedIconFont = Join-Path $generatedOutput 'codex-local-meter.woff'
    if (-not (Test-Path -LiteralPath $generatedIconFont)) {
        throw "Icon font generation completed but no WOFF was found: $generatedIconFont"
    }

    Copy-Item -LiteralPath $generatedIconFont -Destination $iconFont -Force
}

try {
    Write-Host 'Codex Local Meter VSIX rebuild'
    Write-Host "Repository: $repoRoot"
    Write-Host ''

    if ($Install) {
        Write-Host 'Installing npm dependencies...'
        npm install
        Write-Host ''
    }

    if ($VersionBump -ne 'none') {
        Write-Host "Bumping package version: $VersionBump"
        npm version $VersionBump --no-git-tag-version
        Write-Host ''
    }

    Write-Host 'Rebuilding icon font...'
    Build-IconFont
    Write-Host ''

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
