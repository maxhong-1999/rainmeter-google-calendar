param(
    [Parameter(Mandatory = $true)][string]$SkinPath,
    [Parameter(Mandatory = $true)][string]$ConfigName
)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -Path (Join-Path $PSScriptRoot 'CalendarPeek.cs') -ReferencedAssemblies System.Windows.Forms,System.Drawing
    [CalendarPeek.Controller]::Run($SkinPath, $ConfigName, (Join-Path $PSScriptRoot 'CalendarPeek.ini'))
} catch {
    # Keep a diagnostic in the RunCommand measure; no calendar data is read here.
    Write-Output ('Calendar peek: ' + $_.Exception.Message)
    exit 1
}
