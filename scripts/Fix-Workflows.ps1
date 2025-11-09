# scripts/Fix-Workflows.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue)) {
  try {
    Install-Module -Name powershell-yaml -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
  } catch {
    Write-Warning 'powershell-yaml nicht verfügbar. YAML-Validierung wird übersprungen.'
    function ConvertFrom-Yaml { param([string]$Yaml) return $null }
    function ConvertTo-Yaml   { param([Parameter(ValueFromRemainingArguments)]$Data) return $Yaml }
  }
}
Import-Module powershell-yaml -ErrorAction SilentlyContinue

$workflowPath = '.github/workflows'
$targets = @('iac-validate.yml','ci.yml','security-gates.yml','gdpr-compliance.yml')

function Ensure-WorkflowDispatch([string]$yamlText) {
  $doc = ConvertFrom-Yaml -Yaml $yamlText
  if (-not $doc) { throw 'leeres/ungültiges YAML' }

  if (-not ($doc.PSObject.Properties.Name -contains 'on')) {
    $doc | Add-Member -NotePropertyName 'on' -NotePropertyValue (@{}) -Force
  }

  if ($doc.on -isnot [hashtable]) {
    $h = @{}
    foreach ($p in $doc.on.PSObject.Properties) { $h[$p.Name] = $p.Value }
    $doc.on = $h
  }

  if (-not $doc.on.ContainsKey('workflow_dispatch')) {
    $doc.on['workflow_dispatch'] = @{}
  }

  if ($doc.on.Count -eq 1 -and $doc.on.ContainsKey('workflow_dispatch')) {
    if (-not $doc.on.ContainsKey('pull_request')) { $doc.on['pull_request'] = @{ branches = @('main') } }
    if (-not $doc.on.ContainsKey('push'))         { $doc.on['push']         = @{ branches = @('main') } }
  }

  return ConvertTo-Yaml -Data $doc
}

foreach ($name in $targets) {
  $path = Join-Path $workflowPath $name
  if (-not (Test-Path $path)) { Write-Warning ("missing: {0}" -f $name); continue }

  Write-Host ("`n--- {0} ---" -f $name)
  Copy-Item $path "$path.bak" -Force
  $raw = Get-Content $path -Raw

  if ($raw -match 'runner\.temp' -and $raw -notmatch '\$\{\{\s*runner\.temp\s*\}\}') {
    $raw = $raw -replace 'runner\.temp', '$${{ runner.temp }}'
  }

  try {
    $out = Ensure-WorkflowDispatch $raw
  } catch {
    Write-Host ("FAIL {0}: {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
    continue
  }

  Set-Content -Path $path -Value $out -Encoding UTF8

  try {
    $null = ConvertFrom-Yaml -Yaml (Get-Content $path -Raw)
    Write-Host ("OK {0}: validated" -f $name) -ForegroundColor Green
  } catch {
    Write-Host ("FAIL {0}: {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host "`nDone."
