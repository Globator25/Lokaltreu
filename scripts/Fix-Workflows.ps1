# scripts/Fix-Workflows.ps1
# Windows 11 + PowerShell 7
# - patched '${{ runner.temp }}' korrekt (literal $ via $$)
# - fügt workflow_dispatch: {} hinzu, wenn fehlt
# - YAML-Validierung mit powershell-yaml (Fallback ohne Validierung)
# - idempotent, Backups *.bak

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# YAML-Validator laden (fallback, falls Install scheitert)
if (-not (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue)) {
  try {
    Install-Module -Name powershell-yaml -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
    Import-Module powershell-yaml -ErrorAction Stop
  } catch {
    Write-Warning 'powershell-yaml nicht verfügbar. YAML-Validierung wird übersprungen.'
    function ConvertFrom-Yaml { param([string]$s) return $null }
  }
} else {
  Import-Module powershell-yaml -ErrorAction Stop
}

$workflowPath = '.github/workflows'
$targets = @('iac-validate.yml','ci.yml','security-gates.yml','gdpr-compliance.yml')

function Add-Or-Normalize-Dispatch([string]$content) {
  if ($content -notmatch '(?m)^\s*workflow_dispatch:\s*\{\s*\}\s*$') {
    if ($content -match '(?s)^\s*on:\s*\n') {
      $block = @"
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
  workflow_dispatch: {}
"@
      return ($content -replace '(?s)^\s*on:\s*\n', $block)
    } else {
      return "on:`n  workflow_dispatch: {}`n$content"
    }
  }
  return $content
}

foreach ($file in $targets) {
  $full = Join-Path $workflowPath $file
  if (-not (Test-Path $full)) { Write-Warning ("missing: {0}" -f $file); continue }

  Write-Host ("`n--- {0} ---" -f $file)
  Copy-Item $full "$full.bak" -Force

  $c = Get-Content $full -Raw

  # Fix: literal '${{ runner.temp }}'
  # Ersetze nur nackte 'runner.temp' Vorkommen, die nicht schon korrekt templated sind
  if ($c -match 'runner\.temp' -and $c -notmatch '\$\{\{\s*runner\.temp\s*\}\}') {
    $c = $c -replace 'runner\.temp', '$${{ runner.temp }}'
  }

  # Trigger sicherstellen
  $c = Add-Or-Normalize-Dispatch $c

  # Schreiben
  Set-Content -Path $full -Value $c -Encoding UTF8

  # YAML prüfen
  try {
    $null = $c | ConvertFrom-Yaml
    Write-Host ("OK {0}: validated" -f $file) -ForegroundColor Green
  } catch {
    Write-Host ("FAIL {0}: {1}" -f $file, $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host "`nDone."
