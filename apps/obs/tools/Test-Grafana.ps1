param([string]$App = "lokaltreu-obs-grafana")

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "Fly checks for $App" -ForegroundColor Cyan
flyctl checks list -a $App

$url = "https://$App.fly.dev/api/health"
Write-Host "HTTP GET $url" -ForegroundColor Cyan
try {
  $res = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
  Write-Host "Status: $($res.StatusCode)" -ForegroundColor Green
  if ($res.Content) { Write-Host $res.Content }
} catch {
  Write-Warning $_
}
