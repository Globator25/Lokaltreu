param([string]$App="lokaltreu-obs-grafana",[string]$Path="$PSScriptRoot\..\..\apps\obs\grafana")
. "$PSScriptRoot\Ensure-Utf8.ps1"
Set-Location $Path
flyctl deploy -a $App --local-only -y --wait-timeout 900
flyctl logs -a $App --no-tail
