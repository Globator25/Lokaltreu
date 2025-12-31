#!/usr/bin/env pwsh
# Wrapper für GitHub Actions, damit AGENTS.md im CI geprüft wird.
# Delegiert an das bestehende Node-Skript, das auch bei deinen Commits läuft.

Write-Host "Running AGENTS.md sentinel check via Node script..."

# Node-Check ausführen
node ./scripts/agents-sentinel-check.mjs

if ($LASTEXITCODE -ne 0) {
  Write-Error "AGENTS.md sentinel check failed in CI"
  exit $LASTEXITCODE
}

Write-Host "AGENTS.md sentinel check OK (CI)"
exit 0
