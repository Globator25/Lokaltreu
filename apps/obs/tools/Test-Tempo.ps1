param([string]$App = "lokaltreu-obs-tempo")

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProgressPreference = 'SilentlyContinue'
$timeout = 30
$publicHost = "$App.fly.dev"
$publicUrl = "https://$publicHost/ready"
$proxyUrl  = "http://localhost:3200/ready"

Write-Host "Fly checks for $App" -ForegroundColor Cyan
flyctl checks list -a $App

function Test-HasIPv4($name) {
  try {
    $a = Resolve-DnsName -Name $name -Type A -ErrorAction Stop
    return $a.Count -gt 0
  } catch { return $false }
}

if (Test-HasIPv4 $publicHost) {
  Write-Host "HTTP GET $publicUrl (timeout ${timeout}s)" -ForegroundColor Cyan
  try {
    $res = Invoke-WebRequest $publicUrl -UseBasicParsing -TimeoutSec $timeout
    Write-Host "Status: $($res.StatusCode)" -ForegroundColor Green
    if ($res.Content) { Write-Host $res.Content }
    return
  } catch {
    Write-Warning ("Public check failed: {0}" -f $_.Exception.Message)
    Write-Host "Falling back to proxy..." -ForegroundColor Yellow
  }
} else {
  Write-Host "No A-record (IPv4) for $publicHost → skipping public check, trying proxy..." -ForegroundColor Yellow
}

Write-Host "HTTP GET $proxyUrl (timeout ${timeout}s)" -ForegroundColor Cyan
try {
  $res2 = Invoke-WebRequest $proxyUrl -UseBasicParsing -TimeoutSec $timeout
  Write-Host "Proxy Status: $($res2.StatusCode)" -ForegroundColor Green
  if ($res2.Content) { Write-Host $res2.Content }
} catch {
  throw ("Tempo health failed (proxy): {0}" -f $_.Exception.Message)
}


