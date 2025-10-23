$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

[CmdletBinding()]
param(
  [string]$GrafanaApp = 'lokaltreu-obs-grafana',
  [string]$TempoApp   = 'lokaltreu-obs-tempo',
  [string]$LokiApp    = 'lokaltreu-obs-loki'
)

$repo  = Resolve-Path "$PSScriptRoot/../.."
$tools = Join-Path $repo 'apps/obs/tools'

Write-Host "Observability smoke: $GrafanaApp / $TempoApp / $LokiApp" -ForegroundColor Cyan

try {
  & (Join-Path $tools 'Test-Grafana.ps1') -App $GrafanaApp
  & (Join-Path $tools 'Test-Tempo.ps1')   -App $TempoApp
  & (Join-Path $tools 'Test-Loki.ps1')    -App $LokiApp
  Write-Host 'Smoke OK' -ForegroundColor Green
} catch {
  Write-Error ("Smoke failed: {0}" -f $_.Exception.Message)
  exit 1
}

