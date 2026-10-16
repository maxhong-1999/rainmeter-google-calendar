$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\@Resources\CalendarBridge.ps1')
function Assert($condition, $label) { if (!$condition) { throw $label } }
function Assert-Invalid([scriptblock]$work) { $failed=$false;try{& $work | Out-Null}catch{$failed=$true};Assert $failed 'Invalid input was accepted.' }
$event = [pscustomobject]@{summary='Example';start=@{date='2026-10-16'};end=@{date='2026-10-17'}}
Assert ((ConvertTo-EventBody $event).summary -eq 'Example') 'Valid event failed.'
Assert-Invalid { ConvertTo-EventBody ([pscustomobject]@{summary='';start=@{date='2026-10-16'};end=@{date='2026-10-17'}}) }
Assert-Invalid { ConvertTo-EventBody ([pscustomobject]@{summary='x';start=@{date='2026-02-30'};end=@{date='2026-03-01'}}) }
Assert-Invalid { ConvertTo-EventBody ([pscustomobject]@{summary='x';start=@{dateTime='2026-10-16T11:00:00+09:00'};end=@{dateTime='2026-10-16T10:00:00+09:00'}}) }
$pkce = New-Pkce
Assert ($pkce.verifier.Length -ge 43 -and $pkce.challenge -match '^[A-Za-z0-9_-]{43}$') 'PKCE is invalid.'
$tempPath = Join-Path ([IO.Path]::GetTempPath()) ('calendar-auth-test-' + [guid]::NewGuid().ToString('N') + '.bin')
try {
    Save-Connection $tempPath @{refreshToken='example-refresh';clientId='example.apps.googleusercontent.com'}
    Assert ((Read-Connection $tempPath).refreshToken -eq 'example-refresh') 'Encrypted connection did not round trip.'
    Assert (![Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($tempPath)).Contains('example-refresh')) 'Plaintext token was persisted.'
} finally { if(Test-Path -LiteralPath $tempPath){Remove-Item -LiteralPath $tempPath -Force} }
$script:calls = @()
function Invoke-GoogleRequest($connection,$method,$path,$body=$null,$etag=$null) {
    $script:calls += @{method=$method;path=$path;body=$body;etag=$etag}
    if($method -eq 'Get'){return [pscustomobject]@{etag='"current"';eventType='default'}}
    return @{id='example'}
}
$connection=[pscustomobject]@{calendarId='example@example.test'}
Invoke-CalendarOperation ([pscustomobject]@{action='create';event=$event;calendarId=$connection.calendarId}) $connection | Out-Null
Assert ($script:calls[-1].method -eq 'Post' -and $script:calls[-1].path.Contains('sendUpdates=none')) 'Create target failed.'
Assert (!$script:calls[-1].body.Contains('attendees')) 'Create included guests.'
Invoke-CalendarOperation ([pscustomobject]@{action='delete';eventId='example_20261016';etag='"current"';calendarId=$connection.calendarId}) $connection | Out-Null
Assert ($script:calls[-1].method -eq 'Delete' -and $script:calls[-1].etag -eq '"current"') 'Delete did not use the checked ETag.'
Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='delete';eventId='example';etag='"stale"';calendarId=$connection.calendarId}) $connection }
Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='delete';eventId='../other';etag='"current"';calendarId=$connection.calendarId}) $connection }
Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='list';start='2026-01-01';end='2027-01-01';calendarId=$connection.calendarId}) $connection }
Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='create';event=$event;calendarId='other@example.test'}) $connection }
'Calendar bridge validation, encryption and isolated API checks passed.'
