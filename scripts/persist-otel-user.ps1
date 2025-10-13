$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
  [Parameter(Mandatory=$false)][string]$ServiceName = 'lokaltreu-api',
  [Parameter(Mandatory=$false)][string]$Endpoint    = 'http://localhost:4318',
  [Parameter(Mandatory=$false)][string]$Env         = 'dev'
)

$vars = @{
  'OTEL_SERVICE_NAME'           = $ServiceName
  'OTEL_EXPORTER_OTLP_ENDPOINT' = $Endpoint
  'OTEL_RESOURCE_ATTRIBUTES'    = "deployment.environment=$Env"
}

foreach($k in $vars.Keys){
  [Environment]::SetEnvironmentVariable($k, $vars[$k], 'User')
}

Write-Host 'Persisted User-scope env vars:' -ForegroundColor Green
$vars.GetEnumerator() | Sort-Object Name | ForEach-Object { "  {0}={1}" -f $_.Key, $_.Value } | Write-Host

Write-Host 'Verifying in a fresh PowerShell session...' -ForegroundColor Cyan
powershell -NoProfile -Command '$env:OTEL_SERVICE_NAME; $env:OTEL_EXPORTER_OTLP_ENDPOINT; $env:OTEL_RESOURCE_ATTRIBUTES'

