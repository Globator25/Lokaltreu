param([string]$ApiPath = "$PSScriptRoot\..\..\apps\api")
. "$PSScriptRoot\Ensure-Utf8.ps1"
Set-Location $ApiPath
npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node `
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http
