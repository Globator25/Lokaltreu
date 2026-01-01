param()

$agentsPath = Join-Path $PSScriptRoot "..\..\AGENTS.md"

if (-not (Test-Path $agentsPath)) {
    Write-Error "AGENTS.md not found at $agentsPath"
    exit 1
}

Write-Host "AGENTS.md Sentinel-Check OK."
exit 0
