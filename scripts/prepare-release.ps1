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

  # Rainmeter's PackageFooter: int64 ZIP size, byte flags, char key[7].
  # A renamed ZIP without this footer is not a modern .rmskin installer.
  $packageStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Append)
  $packageWriter = New-Object System.IO.BinaryWriter($packageStream)
  try {
    $packageWriter.Write([long]$packageStream.Length)
    $packageWriter.Write([byte]0)
    $packageWriter.Write([System.Text.Encoding]::ASCII.GetBytes("RMSKIN`0"))
  } finally {
    $packageWriter.Dispose()
  }
} finally {
  Pop-Location
}
