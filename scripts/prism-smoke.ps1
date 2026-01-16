param(
  [int]$Port = 4013,
  [string]$ServerHost = "127.0.0.1",
  [switch]$StartPrism,
  [int]$TimeoutSec = 60
)

function Get-HttpStatus {
  param([string]$Url, [hashtable]$Headers = @{})
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Url -Headers $Headers -TimeoutSec 5
    return [int]$resp.StatusCode
  } catch {
    try {
      $ex = $_.Exception
      if ($null -ne $ex -and $null -ne $ex.Response) {
        $status = $ex.Response.StatusCode
        return [int]$status
      }
    } catch {
      # ignore
    }
    return 0
  }
}

function Wait-ForHttpStatus {
  param(
    [string]$Url,
    [int]$ExpectedStatus = 200,
    [int]$TimeoutSec = 60,
    [int]$PollMs = 250,
    [hashtable]$Headers = @{}
  )
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $lastStatus = 0
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    $lastStatus = Get-HttpStatus -Url $Url -Headers $Headers
    if ($lastStatus -eq $ExpectedStatus) { return $true }
    Start-Sleep -Milliseconds $PollMs
  }
  throw "Wait-ForHttpStatus timeout: expected $ExpectedStatus after ${TimeoutSec}s (last=$lastStatus) for $Url"
}

$ErrorActionPreference = "Stop"
$base = "http://$ServerHost`:$Port"

function Test-Listening {
  param([string]$ServerHost, [int]$Port)
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect($ServerHost, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(200)
    if ($ok -and $c.Connected) { $c.Close(); return $true }
    $c.Close(); return $false
  } catch { return $false }
}

function Wait-ForPort {
  param([string]$ServerHost, [int]$Port, [int]$TimeoutSec)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if (Test-Listening -ServerHost $ServerHost -Port $Port) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Wait-ForHttp200 {
  param([string]$Url, [int]$TimeoutSec)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -SkipHttpErrorCheck -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return $true }
    } catch {
      # ignore transient connection errors while starting
    }
    Start-Sleep -Milliseconds 300
  }
  return $false
}

function Get-Http {
  param([string]$Url)
  # -SkipHttpErrorCheck verhindert Exception bei 401/403/etc.
  return Invoke-WebRequest -UseBasicParsing -Uri $Url -SkipHttpErrorCheck -TimeoutSec 10
}

$proc = $null

try {
  if ($StartPrism) {
    if (-not (Test-Listening -ServerHost $ServerHost -Port $Port)) {
      Write-Host "Starting Prism via node on $ServerHost`:$Port ..."
      # Prism-Port wird in diesem Repo über PRISM_PORT (env) gesteuert
      $proc = Start-Process -FilePath "node" `
        -ArgumentList @(".\scripts\prism-mock.mjs") `
        -WorkingDirectory (Get-Location) `
        -Environment @{ "PRISM_PORT" = "$Port" } `
        -PassThru `
        -WindowStyle Normal
    } else {
      Write-Host "Port $Port is already in use; assuming Prism is running."
    }
  }

  Write-Host "Smoke: $base"

  $jwksUrl = "$base/.well-known/jwks.json"
  Wait-ForHttpStatus -Url $jwksUrl -ExpectedStatus 200 -TimeoutSec 60 | Out-Null
  Write-Host "OK: JWKS reachable (200)"

  $headers = @{ Authorization = "Bearer test-token" }
  $summaryUrl = "$base/admins/reporting/summary"
  $tsUrl = "$base/admins/reporting/timeseries?metric=stamps&bucket=week"

  Wait-ForHttpStatus -Url $summaryUrl -ExpectedStatus 200 -TimeoutSec 20 -Headers $headers | Out-Null
  Wait-ForHttpStatus -Url $tsUrl -ExpectedStatus 200 -TimeoutSec 20 -Headers $headers | Out-Null

  Write-Host "OK: prism smoke (jwks + reporting endpoints)"
}
finally {
  if ($proc) {
    Write-Host "Stopping Prism (node PID $($proc.Id))..."
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
