param([string]$App="lokaltreu-obs-loki",[string]$Path="$PSScriptRoot\..\..\apps\obs\loki")
. "$PSScriptRoot\Ensure-Utf8.ps1"
Set-Location $Path
flyctl deploy -a $App --local-only -y --wait-timeout 900
flyctl logs -a $App --no-tail
