param([string]$App = "lokaltreu-obs-loki")

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProgressPreference = 'SilentlyContinue'
$timeout = 30
$publicHost = "$App.fly.dev"
$publicUrl = "https://$publicHost/ready"
$proxyUrl  = "http://localhost:3100/ready"

Write-Host "Fly checks for $App" -ForegroundColor Cyan
flyctl checks list -a $App

function Test-HasIPv4($name) {
  try {
    [System.Net.Dns]::GetHostAddresses($name) |
      Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
      ForEach-Object { return $true }
    return $false
  } catch { return $false }
}

if (Test-HasIPv4 $publicHost) {
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    Write-Host "HTTP GET (IPv4) $publicUrl via curl.exe -4 (timeout ${timeout}s)" -ForegroundColor Cyan
    & $curl.Source -sS -4 --max-time $timeout $publicUrl | Write-Output
    if ($LASTEXITCODE -eq 0) { return }
    Write-Warning "curl.exe failed; trying PowerShell Invoke-WebRequest..."
  }
  try {
    Write-Host "HTTP GET $publicUrl (timeout ${timeout}s, TLS1.2, no H2)" -ForegroundColor Cyan
    $res = Invoke-WebRequest $publicUrl -UseBasicParsing -TimeoutSec $timeout -SslProtocol Tls12 -MaximumRedirection 0 -DisableKeepAlive
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
  throw ("Loki health failed (proxy): {0}" -f $_.Exception.Message)
}


