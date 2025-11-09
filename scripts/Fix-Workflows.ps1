# scripts/Fix-Workflows.ps1
# Windows 11 + PowerShell 7
# - Fügt workflow_dispatch in EXISTIERENDEN on-Block ein (kein Duplikat)
# - Repariert literal '${{ runner.temp }}' via '$$'
# - YAML-Validierung via powershell-yaml
# - Idempotent; erstellt *.bak

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue)) {
  try {
    Install-Module -Name powershell-yaml -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
    Import-Module powershell-yaml -ErrorAction Stop
  } catch {
    Write-Warning "YAML module not available. Validation will be skipped."
    function ConvertFrom-Yaml { param($x) return $null }
    function ConvertTo-Yaml { param([Parameter(ValueFromPipeline=$true)]$Data) return $Data }
  }
} else {
  Import-Module powershell-yaml -ErrorAction Stop
}

$workflowPath = '.github/workflows'
$targets = @('iac-validate.yml','ci.yml','security-gates.yml','gdpr-compliance.yml')

function Ensure-WorkflowDispatch([string]$yamlText) {
  $doc = ConvertFrom-Yaml -Yaml $yamlText
  if (-not $doc) { throw "Leeres/ungültiges YAML" }

  # Top-Level 'on' initialisieren, falls fehlt
  if (-not ($doc.PSObject.Properties.Name -contains 'on')) {
    $doc | Add-Member -NotePropertyName 'on' -NotePropertyValue (@{}) -Force
  }

  # 'on' in Hashtable konvertieren, falls PSCustomObject
  if ($doc.on -isnot [hashtable]) {
    $onHash = @{}
    foreach ($p in $doc.on.PSObject.Properties) { $onHash[$p.Name] = $p.Value }
    $doc.on = $onHash
  }

  # workflow_dispatch hinzufügen, wenn fehlt
  if (-not $doc.on.ContainsKey('workflow_dispatch')) {
    $doc.on['workflow_dispatch'] = @{}
  }

  # Standard-Trigger ergänzen, wenn gar keine existieren
  if ($doc.on.Count -eq 1 -and $doc.on.ContainsKey('workflow_dispatch')) {
    if (-not $doc.on.ContainsKey('pull_request')) { $doc.on['pull_request'] = @{ branches = @('main') } }
    if (-not $doc.on.ContainsKey('push'))         { $doc.on['push']         = @{ branches = @('main') } }
  }

  return ConvertTo-Yaml -Data $doc
}

foreach ($name in $targets) {
  $path = Join-Path $workflowPath $name
  if (-not (Test-Path $path)) { Write-Warning "missing: $name"; continue }

  Write-Host "`n--- $name ---"
  Copy-Item $path "$path.bak" -Force
  $raw = Get-Content $path -Raw

  # runner.temp literal fix, nur wenn nicht schon templated
  if ($raw -match 'runner\.temp') {
    Write-Host "Fixing runner.temp usage..." -ForegroundColor Yellow
    $raw = $raw -replace 'runner\.temp', '$${{ runner.temp }}'
  }

  # on-block korrigieren/ergänzen
  try {
    $out = Ensure-WorkflowDispatch $raw
  } catch {
    Write-Host "FAIL $name: $($_.Exception.Message)" -ForegroundColor Red
    continue
  }

  Set-Content -Path $path -Value $out -Encoding UTF8

  # Validierung – erneut parsen
  try {
    $null = ConvertFrom-Yaml -Yaml (Get-Content $path -Raw)
    Write-Host "OK $name: validated" -ForegroundColor Green
  } catch {
    Write-Host "FAIL $name: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "`nDone."
