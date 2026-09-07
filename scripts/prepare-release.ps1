param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
  pnpm test
  if ($LASTEXITCODE -ne 0) {
    throw 'Tests failed; release staging was not created.'
  }

  node scripts/prepare-rmskin.mjs --version $Version --output output/rmskin-stage
  if ($LASTEXITCODE -ne 0) {
    throw 'RMSKIN staging failed.'
  }
} finally {
  Pop-Location
}
