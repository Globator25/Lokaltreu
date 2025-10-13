param(
  [Parameter(Mandatory=$false)]
  [string]$Path = "$PSScriptRoot/../grafana/provisioning/dashboards/provider.yaml"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path $Path)) {
  Write-Error "File not found: $Path"
  exit 1
}

$content = Get-Content $Path -Raw
Set-Content -Path $Path -Value $content -Encoding utf8NoBOM
Write-Host "Rewrote encoding to UTF-8 (no BOM): $Path"
