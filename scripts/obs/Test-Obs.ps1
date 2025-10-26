param(
  [string]$Grafana="https://lokaltreu-obs-grafana.fly.dev",
  [string]$Tempo  ="https://lokaltreu-obs-tempo.fly.dev",
  [string]$Loki   ="https://lokaltreu-obs-loki.fly.dev"
)
Test-Path "$PSScriptRoot\..\..\apps\obs\grafana\fly.toml"
Test-Path "$PSScriptRoot\..\..\apps\obs\tempo\fly.toml"
Test-Path "$PSScriptRoot\..\..\apps\obs\loki\fly.toml"
Invoke-WebRequest "$Grafana/api/health" -UseBasicParsing -TimeoutSec 10 | Select-Object StatusCode
Invoke-WebRequest "$Tempo/v1/traces"    -Method Options -UseBasicParsing -TimeoutSec 10 | Select-Object StatusCode
Invoke-WebRequest "$Loki/ready"         -UseBasicParsing -TimeoutSec 10 | Select-Object StatusCode
Test-NetConnection ($Grafana -replace '^https?://','') -Port 443
Test-NetConnection ($Tempo   -replace '^https?://','') -Port 443
Test-NetConnection ($Loki    -replace '^https?://','') -Port 443
flyctl apps list | Select-String "lokaltreu-obs-"
