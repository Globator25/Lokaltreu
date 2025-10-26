# Sets OpenTelemetry OTLP environment variables for the current PowerShell session
# and optionally persists them for the current User or Machine.
#
# Usage examples:
#   ./scripts/set-otel-env.ps1
#   ./scripts/set-otel-env.ps1 -Persist                 # persist for current User
#   ./scripts/set-otel-env.ps1 -Persist -Scope Machine  # persist system-wide (requires Admin)
#   ./scripts/set-otel-env.ps1 -Remove -Persist         # remove persisted User values
#   ./scripts/set-otel-env.ps1 -Remove                  # clear only session values

$ErrorActionPreference = 'Stop'

param(
  [string]$Endpoint = "https://otel-collector.example:4318",
  [ValidateSet("http/protobuf", "grpc")]
  [string]$Protocol = "http/protobuf",

  [string]$ServiceName = "lokaltreu",
  [string]$ServiceVersion = "dev",
  [string]$DeploymentEnvironment = "dev",

  [string]$LogsExporter = "otlp",
  [string]$TracesExporter = "otlp",
  [string]$MetricsExporter = "otlp",

  [switch]$Persist,
  [ValidateSet("User", "Machine")]
  [string]$Scope = "User",
  [switch]$Remove
)

$resourceAttributes = "service.name=$ServiceName,service.version=$ServiceVersion,deployment.environment=$DeploymentEnvironment"

function Set-SessionEnv {
  param(
    [Parameter(Mandatory=$true)] [string]$Name,
    [Parameter(Mandatory=$false)] [string]$Value
  )
  if ($Remove) {
    Remove-Item -Path Env:$Name -ErrorAction SilentlyContinue | Out-Null
  } else {
    Set-Item -Path Env:$Name -Value $Value | Out-Null
  }
}

function Set-PersistEnv {
  param(
    [Parameter(Mandatory=$true)] [string]$Name,
    [Parameter(Mandatory=$false)] [string]$Value
  )
  if (-not $Persist) { return }
  if ($Remove) {
    [Environment]::SetEnvironmentVariable($Name, $null, $Scope)
  } else {
    [Environment]::SetEnvironmentVariable($Name, $Value, $Scope)
  }
}

$vars = @{
  'OTEL_EXPORTER_OTLP_ENDPOINT' = $Endpoint
  'OTEL_EXPORTER_OTLP_PROTOCOL' = $Protocol
  'OTEL_RESOURCE_ATTRIBUTES'    = $resourceAttributes
  'OTEL_LOGS_EXPORTER'          = $LogsExporter
  'OTEL_TRACES_EXPORTER'        = $TracesExporter
  'OTEL_METRICS_EXPORTER'       = $MetricsExporter
}

foreach ($kvp in $vars.GetEnumerator()) {
  Set-SessionEnv -Name $kvp.Key -Value $kvp.Value
  Set-PersistEnv -Name $kvp.Key -Value $kvp.Value
}

if ($Remove) {
  Write-Host "OTEL env vars removed from session." -ForegroundColor Yellow
  if ($Persist) { Write-Host "Persisted OTEL vars removed at scope '$Scope'." -ForegroundColor Yellow }
} else {
  Write-Host "OTEL env vars set in session:" -ForegroundColor Green
  $vars.Keys | Sort-Object | ForEach-Object { Write-Host ("  {0}={1}" -f $_, $env:$_) }
  if ($Persist) {
    Write-Host "Also persisted at scope '$Scope'. Open a new terminal/IDE to pick them up." -ForegroundColor Green
  }
}

if ($Protocol -eq 'grpc' -and $Endpoint -match ':4318') {
  Write-Warning "Protocol 'grpc' usually uses port 4317. Verify endpoint: $Endpoint"
}
if ($Protocol -eq 'http/protobuf' -and $Endpoint -match ':4317') {
  Write-Warning "Protocol 'http/protobuf' usually uses port 4318. Verify endpoint: $Endpoint"
}
