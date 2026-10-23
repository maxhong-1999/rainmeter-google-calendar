param([string]$SkinPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.Web
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$script:Scopes = @('https://www.googleapis.com/auth/calendar.events.owned','https://www.googleapis.com/auth/calendar.calendarlist.readonly')

function ConvertTo-Query($values) {
    return (($values.GetEnumerator() | ForEach-Object { [uri]::EscapeDataString([string]$_.Key) + '=' + [uri]::EscapeDataString([string]$_.Value) }) -join '&')
}
function New-RandomCode {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
function New-Pkce {
    $verifier = New-RandomCode
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $challenge = [Convert]::ToBase64String($hash.ComputeHash([Text.Encoding]::ASCII.GetBytes($verifier))).TrimEnd('=').Replace('+','-').Replace('/','_') } finally { $hash.Dispose() }
    return @{verifier=$verifier;challenge=$challenge}
}
function Save-Connection($path,$connection) {
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path)) | Out-Null
    $bytes = [Text.Encoding]::UTF8.GetBytes(($connection | ConvertTo-Json -Depth 12 -Compress))
    $encrypted = [Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($path,$encrypted)
}
function Read-Connection($path) {
    if (!(Test-Path -LiteralPath $path)) { return $null }
    try {
        $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
        return ([Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json)
    } catch { throw 'not_connected' }
}
function ConvertTo-Day([string]$value) {
    $date = [datetime]::MinValue
    if (![datetime]::TryParseExact($value,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$date)) { throw 'invalid' }
    return $date
}
function ConvertTo-EventBody($event,[switch]$AllowEmptyTitle) {
    $title = [string]$event.summary
    if ((!$AllowEmptyTitle -and [string]::IsNullOrWhiteSpace($title)) -or $title.Length -gt 200) { throw 'invalid' }
    if ($event.start.date -and $event.end.date) {
        $start = ConvertTo-Day $event.start.date; $end = ConvertTo-Day $event.end.date
        if ($end -le $start -or ($end-$start).TotalDays -gt 366) { throw 'invalid' }
        return @{summary=$title.Trim();start=@{date=$start.ToString('yyyy-MM-dd')};end=@{date=$end.ToString('yyyy-MM-dd')}}
    }
    $startTime = [datetimeoffset]::MinValue; $endTime = [datetimeoffset]::MinValue
    if (![datetimeoffset]::TryParseExact([string]$event.start.dateTime,'yyyy-MM-ddTHH:mm:sszzz',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$startTime)) { throw 'invalid' }
    if (![datetimeoffset]::TryParseExact([string]$event.end.dateTime,'yyyy-MM-ddTHH:mm:sszzz',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$endTime)) { throw 'invalid' }
    if ($endTime -le $startTime -or ($endTime-$startTime).TotalDays -gt 366 -or $startTime.Offset.TotalHours -ne 9 -or $endTime.Offset.TotalHours -ne 9) { throw 'invalid' }
    return @{summary=$title.Trim();start=@{dateTime=$startTime.ToString('yyyy-MM-ddTHH:mm:sszzz');timeZone='Asia/Seoul'};end=@{dateTime=$endTime.ToString('yyyy-MM-ddTHH:mm:sszzz');timeZone='Asia/Seoul'}}
}
function Get-AccessToken($connection) {
    if (!$connection) { throw 'not_connected' }
    if ([long]$connection.expiresAt -gt [datetimeoffset]::UtcNow.ToUnixTimeSeconds()+60) { return $connection.accessToken }
    try {
        $token = Invoke-RestMethod -Uri 'https://oauth2.googleapis.com/token' -Method Post -Body @{
            client_id=$connection.clientId;client_secret=$connection.clientSecret;refresh_token=$connection.refreshToken;grant_type='refresh_token'
        } -TimeoutSec 20
    } catch { throw 'denied' }
    if (!$token.access_token) { throw 'denied' }
    $connection.accessToken = $token.access_token
    $connection.expiresAt = [datetimeoffset]::UtcNow.ToUnixTimeSeconds() + [long]$token.expires_in
    if ($token.refresh_token) { $connection.refreshToken=$token.refresh_token }
    Save-Connection $script:ConnectionPath $connection
    return $connection.accessToken
}
function Invoke-GoogleRequest($connection,$method,$path,$body=$null,$etag=$null) {
    $headers = @{Authorization='Bearer ' + (Get-AccessToken $connection)}
    if ($etag) { $headers['If-Match']=$etag }
    $arguments = @{Uri=('https://www.googleapis.com/calendar/v3' + $path);Method=$method;Headers=$headers;TimeoutSec=20}
    if ($null -ne $body) { $arguments.ContentType='application/json; charset=utf-8';$arguments.Body=[Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 12 -Compress)) }
    try { return Invoke-RestMethod @arguments }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status=[int]$_.Exception.Response.StatusCode }
        if ($status -eq 412 -or $status -eq 404 -or $status -eq 410) { throw 'stale' }
        if ($status -eq 401 -or $status -eq 403) { throw 'denied' }
        throw 'network'
    }
}
function Get-OwnedCalendars($connection) {
    $items = @(); $page = ''
    do {
        $query = @{minAccessRole='owner';maxResults=250;fields='items(id,summary,primary,accessRole),nextPageToken'}
        if ($page) { $query.pageToken=$page }
        $result = Invoke-GoogleRequest $connection Get ('/users/me/calendarList?' + (ConvertTo-Query $query))
        $items += @($result.items | Where-Object {$_.accessRole -eq 'owner'} | ForEach-Object { @{id=$_.id;summary=$_.summary;primary=[bool]$_.primary} })
        $page=$result.nextPageToken
    } while ($page)
    if (!$items.Count) { throw 'denied' }
    return $items
}
function Connect-Google($client) {
    if ([string]$client.client_id -notmatch '^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$' -or ([string]$client.client_secret).Length -gt 1024) { throw 'invalid' }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
    $listener.Start()
    try {
        $port = $listener.LocalEndpoint.Port
        $redirect = 'http://127.0.0.1:' + $port + '/'
        $state=New-RandomCode; $pkce=New-Pkce
        $query = ConvertTo-Query @{
            client_id=$client.client_id;redirect_uri=$redirect;response_type='code';scope=($script:Scopes -join ' ');
            state=$state;code_challenge=$pkce.challenge;code_challenge_method='S256';access_type='offline';prompt='consent select_account'
        }
        # 사용자가 직접 로그인하는 브라우저 창이다.
        Start-Process -FilePath ('https://accounts.google.com/o/oauth2/v2/auth?' + $query)
        $watch=[Diagnostics.Stopwatch]::StartNew();$code=$null
        while (!$code -and $watch.Elapsed.TotalSeconds -lt 180) {
            if (!$listener.Pending()) { Start-Sleep -Milliseconds 100;continue }
            $socket=$listener.AcceptTcpClient()
            try {
                $stream=$socket.GetStream();$stream.ReadTimeout=3000
                $reader=[IO.StreamReader]::new($stream,[Text.Encoding]::ASCII,$false,1024,$true)
                $line=$reader.ReadLine()
                if (!$line -or $line.Length -gt 12000 -or $line -notmatch '^GET (/\?[^ ]+) HTTP/1\.[01]$') { continue }
                $uri=[uri]($redirect.TrimEnd('/')+$Matches[1]);$parameters=[Web.HttpUtility]::ParseQueryString($uri.Query)
                if ($parameters['state'] -cne $state) { continue }
                $html='<html lang="ko"><meta charset="utf-8"><title>연결 완료</title><p>이 창을 닫고 달력으로 돌아가세요.</p></html>'
                $bytes=[Text.Encoding]::UTF8.GetBytes($html)
                $header=[Text.Encoding]::ASCII.GetBytes((@('HTTP/1.1 200 OK','Content-Type: text/html; charset=utf-8','Cache-Control: no-store',('Content-Length: '+$bytes.Length),'Connection: close','','') -join ([string][char]13+[char]10)))
                $stream.Write($header,0,$header.Length);$stream.Write($bytes,0,$bytes.Length);$stream.Flush()
                if ($parameters['error']) { throw 'denied' }
                $code=$parameters['code']
            } finally { $socket.Close() }
        }
        if (!$code) { throw 'timeout' }
        try {
            $token=Invoke-RestMethod -Uri 'https://oauth2.googleapis.com/token' -Method Post -Body @{
                client_id=$client.client_id;client_secret=$client.client_secret;redirect_uri=$redirect;code=$code;code_verifier=$pkce.verifier;grant_type='authorization_code'
            } -TimeoutSec 20
        } catch { throw 'denied' }
        $granted=@(([string]$token.scope).Split(' '))
        $all=$granted -contains 'https://www.googleapis.com/auth/calendar'
        if ((!$all -and $granted -notcontains $script:Scopes[0]) -or (!$all -and $granted -notcontains $script:Scopes[1]) -or !$token.refresh_token) { throw 'denied' }
        $connection=[pscustomobject]@{clientId=$client.client_id;clientSecret=$client.client_secret;refreshToken=$token.refresh_token;accessToken=$token.access_token;expiresAt=([datetimeoffset]::UtcNow.ToUnixTimeSeconds()+[long]$token.expires_in);calendarId='';calendars=@()}
        $connection.calendars=@(Get-OwnedCalendars $connection)
        $primary=@($connection.calendars | Where-Object {$_.primary}) | Select-Object -First 1
        if (!$primary) { $primary=$connection.calendars[0] }
        $connection.calendarId=$primary.id
        return $connection
    } finally { $listener.Stop() }
}
function Get-PublicConnection($connection) {
    if (!$connection) { return @{connected=$false} }
    return @{connected=$true;calendarId=$connection.calendarId;calendars=@($connection.calendars)}
}
function Invoke-CalendarOperation($request,$connection) {
    if (!$connection) { throw 'not_connected' }
    if ([string]$request.calendarId -cne [string]$connection.calendarId) { throw 'stale' }
    $base='/calendars/'+[uri]::EscapeDataString([string]$connection.calendarId)+'/events'
    switch ($request.action) {
        'list' {
            $start=ConvertTo-Day $request.start;$end=ConvertTo-Day $request.end
            if ($end -le $start -or ($end-$start).TotalDays -gt 62) { throw 'invalid' }
            $items=@();$page=''
            do {
                $query=@{timeMin=($request.start+'T00:00:00+09:00');timeMax=($request.end+'T00:00:00+09:00');singleEvents='true';orderBy='startTime';maxResults=2500;maxAttendees=1;fields='items(id,etag,summary,status,start,end,recurringEventId,eventType,locked,attendees(self)),nextPageToken'}
                if($page){$query.pageToken=$page}
                $result=Invoke-GoogleRequest $connection Get ($base+'?'+(ConvertTo-Query $query))
                $items+=@($result.items);$page=$result.nextPageToken
                if($items.Count -gt 20000){throw 'invalid'}
            } while($page)
            return @{calendarId=$connection.calendarId;items=$items}
        }
        'create' {
            $body=ConvertTo-EventBody $request.event
            return Invoke-GoogleRequest $connection Post ($base+'?sendUpdates=none') $body
        }
        { $_ -in @('delete','update') } {
            if ([string]$request.eventId -notmatch '^[A-Za-z0-9_-]{1,1024}$' -or [string]$request.etag -notmatch '^"[^"\\\r\n]{1,200}"$') { throw 'invalid' }
            $path=$base+'/'+[uri]::EscapeDataString([string]$request.eventId)
            $event=Invoke-GoogleRequest $connection Get ($path+'?fields=etag,attendees(self),locked,eventType,recurrence')
            if ($event.etag -cne $request.etag) { throw 'stale' }
            if ($event.locked -or $event.recurrence -or $event.attendees -or ($event.eventType -and $event.eventType -ne 'default')) { throw 'readonly' }
            if ($request.action -eq 'delete') {
                Invoke-GoogleRequest $connection Delete ($path+'?sendUpdates=none') $null $request.etag | Out-Null
                return @{deleted=$true}
            }
            $body=ConvertTo-EventBody $request.event -AllowEmptyTitle
            if ($null -eq $request.event.PSObject.Properties['summary']) { $body.Remove('summary') }
            if ($body.start.date) {
                $body.start.dateTime=$null;$body.start.timeZone=$null
                $body.end.dateTime=$null;$body.end.timeZone=$null
            } else { $body.start.date=$null;$body.end.date=$null }
            $fields='id,etag,summary,status,start,end,recurringEventId,eventType,locked,attendees(self)'
            return Invoke-GoogleRequest $connection Patch ($path+'?sendUpdates=none&fields='+[uri]::EscapeDataString($fields)) $body $request.etag
        }
        default { throw 'invalid' }
    }
}
function Invoke-BridgeMain([string]$root) {
    $requestId=$null;$responsePath=$null
    try {
        $root=[IO.Path]::GetFullPath($root)
        if (!(Test-Path -LiteralPath (Join-Path $root 'GoogleCalendar.ini'))) { throw 'invalid' }
        $resources=Join-Path $root '@Resources'
        $requestPath=Join-Path $resources 'CalendarBridge.ini'
        $responsePath=Join-Path $resources 'CalendarBridgeResponse.json'
        $line=([IO.File]::ReadAllLines($requestPath) | Where-Object {$_ -match '^Request='} | Select-Object -First 1)
        [IO.File]::WriteAllText($requestPath,("[Variables]"+[Environment]::NewLine+"Request="+[Environment]::NewLine),[Text.Encoding]::Unicode)
        $encoded=$line.Substring(8)
        if ($encoded.Length -gt 22000 -or $encoded -notmatch '^[A-Za-z0-9+/=]+$') { throw 'invalid' }
        $request=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)) | ConvertFrom-Json
        $requestId=[string]$request.requestId
        if($requestId -notmatch '^[a-f0-9-]{36}$' -or [Math]::Abs([datetimeoffset]::UtcNow.ToUnixTimeMilliseconds()-[double]$request.issuedAt) -gt 120000){throw 'invalid'}
        if($request.action -notin @('status','connect','disconnect','select','list','create','update','delete')){throw 'invalid'}
        $hash=[Security.Cryptography.SHA256]::Create()
        try{$key=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.TrimEnd('\').ToLowerInvariant())))).Replace('-','')}finally{$hash.Dispose()}
        $script:ConnectionPath=Join-Path $env:LOCALAPPDATA ('RainmeterGoogleCalendar\'+$key+'.bin')
        $connection=if($request.action -in @('connect','disconnect')){$null}else{Read-Connection $script:ConnectionPath}
        switch($request.action){
            'status' {$data=Get-PublicConnection $connection}
            'connect' {$connection=Connect-Google $request.client;Save-Connection $script:ConnectionPath $connection;$data=Get-PublicConnection $connection}
            'disconnect' {if(Test-Path -LiteralPath $script:ConnectionPath){Remove-Item -LiteralPath $script:ConnectionPath -Force};$data=@{connected=$false}}
            'select' {
                if(!$connection){throw 'not_connected'}
                $connection.calendars=@(Get-OwnedCalendars $connection)
                if(!@($connection.calendars | Where-Object {$_.id -ceq $request.calendarId}).Count){throw 'denied'}
                $connection.calendarId=$request.calendarId;Save-Connection $script:ConnectionPath $connection;$data=Get-PublicConnection $connection
            }
            default {$data=Invoke-CalendarOperation $request $connection}
        }
        $response=@{requestId=$requestId;ok=$true;data=$data}
    } catch {
        $errorCode=[string]$_.Exception.Message
        if($errorCode -notin @('invalid','denied','not_connected','stale','readonly','timeout','network')){$errorCode='network'}
        $response=@{requestId=$requestId;ok=$false;error=$errorCode}
    }
    if($responsePath){
        $temp=$responsePath+'.tmp'
        try{[IO.File]::WriteAllText($temp,($response | ConvertTo-Json -Depth 20 -Compress),[Text.UTF8Encoding]::new($false));Move-Item -LiteralPath $temp -Destination $responsePath -Force}
        finally{if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force}}
    }
}
if ($MyInvocation.InvocationName -ne '.') { Invoke-BridgeMain $SkinPath }
