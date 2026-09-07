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

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $stageRoot = Join-Path $projectRoot 'output/rmskin-stage'
  $archivePath = Join-Path $projectRoot "output/GoogleCalendar_$Version.rmskin"
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stageRoot,
    $archivePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
} finally {
  Pop-Location
}
