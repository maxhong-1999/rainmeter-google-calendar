$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Path (Join-Path $PSScriptRoot '../@Resources/CalendarPeek.cs') -ReferencedAssemblies System.Windows.Forms,System.Drawing
function Assert-Equal($actual, $expected, [string]$label) {
    if ($actual -ne $expected) { throw "$label : expected $expected, got $actual" }
}
function New-State { New-Object CalendarPeek.PeekState(400, 600) }
$s = New-State
Assert-Equal ($s.Tick(0, $true, $false, $false, $false)) 'None' 'corner starts dwell'
Assert-Equal ($s.Tick(399, $true, $false, $false, $false)) 'None' 'no early opening'
Assert-Equal ($s.Tick(400, $true, $false, $false, $false)) 'Open' 'opens at dwell threshold'
Assert-Equal ($s.Tick(450, $false, $true, $false, $false)) 'None' 'cursor inside calendar keeps it open'
Assert-Equal ($s.Tick(500, $false, $false, $false, $false)) 'None' 'leaving starts delay'
Assert-Equal ($s.Tick(1099, $false, $false, $false, $false)) 'None' 'no early close'
Assert-Equal ($s.Tick(1100, $false, $false, $false, $false)) 'Close' 'closes after delay'
$s = New-State
$null = $s.Tick(0, $true, $false, $false, $false)
$null = $s.Tick(200, $false, $false, $false, $false)
Assert-Equal ($s.Tick(400, $true, $false, $false, $false)) 'None' 'leaving resets dwell'
Assert-Equal ($s.Tick(800, $true, $false, $false, $false)) 'Open' 'new dwell can open'
$null = $s.Tick(900, $false, $false, $false, $false)
$null = $s.Tick(1400, $false, $true, $false, $false)
Assert-Equal ($s.Tick(1600, $false, $true, $false, $false)) 'None' 'reentry cancels close'
Assert-Equal ($s.Tick(1700, $false, $true, $true, $false)) 'Close' 'fullscreen closes popup'
Assert-Equal ($s.Tick(2200, $true, $false, $true, $false)) 'None' 'blocked corner never opens'
$s = New-State
$null = $s.Tick(0, $true, $false, $false, $false)
$null = $s.Tick(400, $true, $false, $false, $false)
Assert-Equal ($s.Tick(450, $true, $true, $false, $true)) 'Close' 'escape closes'
Assert-Equal ($s.Tick(1200, $true, $false, $false, $false)) 'None' 'escape requires leaving corner'
$null = $s.Tick(1300, $false, $false, $false, $false)
$null = $s.Tick(1400, $true, $false, $false, $false)
Assert-Equal ($s.Tick(1800, $true, $false, $false, $false)) 'Open' 'corner rearmed after leaving'
$s = New-State
$null = $s.Tick(0, $true, $false, $false, $false)
$s.ResetDwell()
Assert-Equal ($s.Tick(400, $true, $false, $false, $false)) 'None' 'crossing monitor resets dwell'
$bounds = New-Object System.Drawing.Rectangle(-1920, -100, 1920, 1080)
$p = New-Object System.Drawing.Point(-1920, -100)
Assert-Equal ([CalendarPeek.Geometry]::AtCorner($p, $bounds, 'TopLeft', 6)) $true 'negative monitor origin'
Assert-Equal ([CalendarPeek.Geometry]::AtCorner((New-Object System.Drawing.Point(-1914, -94)), $bounds, 'TopLeft', 6)) $false 'outside trigger area'
Assert-Equal ([CalendarPeek.Geometry]::AtCorner((New-Object System.Drawing.Point(-1, 979)), $bounds, 'BottomRight', 6)) $true 'bottom right edge'
$position = [CalendarPeek.Geometry]::PopupPosition($bounds, 'BottomRight', 600, 420, 12)
Assert-Equal $position.X -612 'right aligned popup'
Assert-Equal $position.Y 548 'bottom aligned popup'
$small = New-Object System.Drawing.Rectangle(0, 0, 400, 300)
Assert-Equal ([CalendarPeek.Geometry]::IsFullscreen($bounds, $bounds, $true)) $false 'captioned maximized app is not fullscreen'
Assert-Equal ([CalendarPeek.Geometry]::IsFullscreen($bounds, $bounds, $false)) $true 'borderless fullscreen blocks invocation'
Assert-Equal ([CalendarPeek.Geometry]::IsFullscreen($small, (New-Object System.Drawing.Rectangle(0, 0, 1920, 1080)), $false)) $false 'ordinary borderless window does not block'
$position = [CalendarPeek.Geometry]::PopupPosition($small, 'BottomRight', 600, 420, 12)
Assert-Equal $position.X 0 'small screen never moves off left edge'
Assert-Equal $position.Y 0 'small screen never moves off top edge'
$settings = [CalendarPeek.Settings]::Parse("[CalendarPeek]`nCorner=BottomLeft`nOpenDelayMs=800`nCloseDelayMs=900`nIdleMode=Hidden`nEnabled=0")
Assert-Equal $settings.Corner 'BottomLeft' 'configured corner'
Assert-Equal $settings.OpenDelayMs 800 'configured dwell'
Assert-Equal $settings.CloseDelayMs 900 'configured close delay'
Assert-Equal $settings.IdleMode 'Hidden' 'hidden mode'
Assert-Equal $settings.Enabled $false 'can disable controller'
$settings = [CalendarPeek.Settings]::Parse("[Variables]`nCorner=BottomRight`nIdleMode=Hidden`nOpenDelayMs=700")
Assert-Equal $settings.Corner 'BottomRight' 'installer-preserved Variables section is read'
Assert-Equal $settings.IdleMode 'Hidden' 'installer-preserved idle mode is read'
Assert-Equal $settings.OpenDelayMs 700 'installer-preserved dwell is read'
$settings = [CalendarPeek.Settings]::Parse("[Other]`nEnabled=0`n[CalendarPeek]`nCorner=bad`nOpenDelayMs=-100`nCloseDelayMs=oops`nTriggerSize=99999")
Assert-Equal $settings.Enabled $true 'unrelated sections ignored'
Assert-Equal $settings.Corner 'TopLeft' 'invalid corner falls back'
Assert-Equal $settings.OpenDelayMs 400 'invalid dwell falls back'
Assert-Equal $settings.CloseDelayMs 600 'invalid delay falls back'
Assert-Equal $settings.TriggerSize 6 'oversized area falls back'
[CalendarPeek.Native]::ConfigureDpi()
$window = New-Object System.Windows.Forms.Form
try {
    $handle = $window.Handle
    Assert-Equal ([CalendarPeek.Native]::MovePhysical($handle, (New-Object System.Drawing.Point(123,234)))) $true 'native adapter accepts a point outside the old window'
    $actual = New-Object CalendarPeek.Native+Rect
    $null = [CalendarPeek.Native]::GetWindowRect($handle, [ref]$actual)
    Assert-Equal $actual.Left 123 'native adapter uses physical x'
    Assert-Equal $actual.Top 234 'native adapter uses physical y'
    Assert-Equal ([CalendarPeek.Native]::CurrentLogicalPosition($handle).ToString()) ([System.Drawing.Point]::new(123,234).ToString()) 'current-window position can be saved without scaling it twice'
} finally { $window.Dispose() }
Write-Output 'Calendar peek behavior and native adapter tests passed.'
