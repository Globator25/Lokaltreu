param(
  [int]$Port = 4013,
  [string]$ServerHost = "127.0.0.1",
  [switch]$StartPrism,
  [int]$TimeoutSec = 20
)

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

$proc = $null

try {
  if ($StartPrism) {
    if (-not (Test-Listening -ServerHost $ServerHost -Port $Port)) {
      Write-Host "Starting Prism via npm on $ServerHost`:$Port ..."
      $proc = Start-Process -FilePath "npm" `
        -ArgumentList @("--workspaces=false","run","prism:mock","--",$Port) `
        -WorkingDirectory (Get-Location) `
        -PassThru `
        -WindowStyle Normal
    } else {
      Write-Host "Port $Port is already in use; assuming Prism is running."
    }
  }

  Write-Host "Smoke: $base"

  if (-not (Wait-ForPort -ServerHost $ServerHost -Port $Port -TimeoutSec $TimeoutSec)) {
    throw "Prism not reachable on $ServerHost`:$Port after ${TimeoutSec}s"
  }

  $summary = Invoke-RestMethod "$base/admins/reporting/summary"
  $ts = Invoke-RestMethod "$base/admins/reporting/timeseries?metric=stamps&bucket=day"

  if (-not $summary.stamps) { throw "Missing summary.stamps" }
  if ($ts.metric -ne "stamps") { throw "Unexpected metric: $($ts.metric)" }
  if ($ts.bucket -ne "day") { throw "Unexpected bucket: $($ts.bucket)" }

  Write-Host "OK: summary + timeseries"
}
finally {
  if ($proc) {
    Write-Host "Stopping Prism (npm PID $($proc.Id))..."
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
