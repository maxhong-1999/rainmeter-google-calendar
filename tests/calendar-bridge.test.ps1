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
$script:existingEvent = [pscustomobject]@{etag='"current"';eventType='default';description='Keep this';reminders=@{useDefault=$true}}
function Invoke-GoogleRequest($connection,$method,$path,$body=$null,$etag=$null) {
    $script:calls += @{method=$method;path=$path;body=$body;etag=$etag}
    if($method -eq 'Get'){return $script:existingEvent}
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
Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example_20261023';etag='"current"';event=$event;calendarId=$connection.calendarId}) $connection | Out-Null
Assert ($script:calls[-1].method -eq 'Patch' -and $script:calls[-1].path.StartsWith('/calendars/example%40example.test/events/example_20261023?')) 'Update did not target only the selected occurrence.'
Assert ($script:calls[-1].etag -eq '"current"') 'Update did not check the ETag.'
Assert (($script:calls[-1].body.Keys | Sort-Object) -join ',' -eq 'end,start,summary') 'Update included unrelated fields.'
Assert ($script:calls[-1].body.start.Contains('dateTime') -and $null -eq $script:calls[-1].body.start.dateTime) 'All-day update did not clear old time.'
$timed=[pscustomobject]@{summary='Timed';start=@{dateTime='2026-10-23T09:00:15+09:00'};end=@{dateTime='2026-10-23T10:00:45+09:00'}}
Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example';etag='"current"';event=$timed;calendarId=$connection.calendarId}) $connection | Out-Null
Assert ($script:calls[-1].body.start.Contains('date') -and $null -eq $script:calls[-1].body.start.date) 'Timed update did not clear old all-day date.'
$datesOnly=[pscustomobject]@{start=@{date='2026-10-23'};end=@{date='2026-10-24'}}
Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example';etag='"current"';event=$datesOnly;calendarId=$connection.calendarId}) $connection | Out-Null
Assert (!$script:calls[-1].body.Contains('summary')) 'Date-only update changed the title.'
$clearTitle=[pscustomobject]@{summary='';start=@{date='2026-10-23'};end=@{date='2026-10-24'}}
Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example';etag='"current"';event=$clearTitle;calendarId=$connection.calendarId}) $connection | Out-Null
Assert ($script:calls[-1].body.Contains('summary') -and $script:calls[-1].body.summary -eq '') 'An intentional blank title was not accepted.'
Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example';etag='"stale"';event=$event;calendarId=$connection.calendarId}) $connection }
Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example';etag='"current"';event=$event;calendarId='other@example.test'}) $connection }
foreach($protected in @(@{attendees=@(@{self=$false})},@{locked=$true},@{recurrence=@('RRULE:FREQ=DAILY')},@{eventType='birthday'})){
    $script:existingEvent=[pscustomobject](@{etag='"current"'}+$protected)
    $before=$script:calls.Count
    Assert-Invalid { Invoke-CalendarOperation ([pscustomobject]@{action='update';eventId='example';etag='"current"';event=$event;calendarId=$connection.calendarId}) $connection }
    Assert (@($script:calls | Select-Object -Skip $before | Where-Object {$_.method -eq 'Patch'}).Count -eq 0) 'A protected event was changed.'
}
'Calendar bridge validation, encryption and isolated API checks passed.'
