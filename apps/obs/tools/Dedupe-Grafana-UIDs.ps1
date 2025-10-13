<#
  Deduplicate Grafana dashboard UIDs across JSON and NDJSON exports.
  - Keeps the first occurrence of a UID, removes subsequent duplicates.
  - For JSON: deletes duplicate files.
  - For NDJSON: removes duplicate lines in-place, writing utf8NoBOM.

  Usage:
    ./apps/obs/tools/Dedupe-Grafana-UIDs.ps1 `
      -DashPath apps/obs/grafana/provisioning/dashboards/lokaltreu `
      [-WhatIf] [-DryRun]
#>

param(
  [string]$DashPath = "$PSScriptRoot/../grafana/provisioning/dashboards/lokaltreu",
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path $DashPath)) {
  Write-Error "Dashboards path not found: $DashPath"
  exit 1
}

# Collect UIDs from JSON (one per file)
$uidsJson = Get-ChildItem $DashPath -Recurse -Filter *.json | ForEach-Object {
  try {
    $obj = Get-Content $_ -Raw | ConvertFrom-Json -ErrorAction Stop
    if ($obj.uid) { [pscustomobject]@{ Kind='json'; Uid=$obj.uid; Path=$_.FullName } }
  } catch {}
} | Where-Object { $_ }

# Collect UIDs from NDJSON (many per file)
$uidsNd = Get-ChildItem $DashPath -Recurse -Filter *.ndjson | ForEach-Object {
  $lines = Get-Content $_
  for ($i=0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].Trim()
    if (-not $line) { continue }
    try {
      $o = $line | ConvertFrom-Json -ErrorAction Stop
      $uid = if ($o.uid) { $o.uid } elseif ($o.dashboard.uid) { $o.dashboard.uid } else { $null }
      if ($uid) { [pscustomobject]@{ Kind='ndjson'; Uid=$uid; Path=$_.FullName; Line=$i } }
    } catch {}
  }
} | Where-Object { $_ }

$all = @()
if ($uidsJson) { $all += $uidsJson }
if ($uidsNd)   { $all += $uidsNd }

if (-not $all -or $all.Count -eq 0) {
  Write-Host "No dashboards with UIDs found under $DashPath"
  exit 0
}

$groups = $all | Group-Object Uid | Where-Object Count -gt 1
if (-not $groups) {
  Write-Host "No duplicate UIDs found."
  exit 0
}

Write-Host ("Found {0} duplicate UID groups" -f $groups.Count)

# Determine deletions while keeping first occurrence
$jsonDeletes = @()
$ndjsonDeletesByFile = @{}

foreach ($g in $groups) {
  $ordered = $g.Group
  # keep first
  $toDelete = $ordered | Select-Object -Skip 1
  foreach ($d in $toDelete) {
    if ($d.Kind -eq 'json') {
      $jsonDeletes += $d.Path
    } else {
      if (-not $ndjsonDeletesByFile.ContainsKey($d.Path)) { $ndjsonDeletesByFile[$d.Path] = New-Object System.Collections.Generic.HashSet[int] }
      [void]$ndjsonDeletesByFile[$d.Path].Add([int]$d.Line)
    }
  }
}

$jsonDeletes = $jsonDeletes | Sort-Object -Unique

Write-Host "JSON files to delete: $($jsonDeletes.Count)"
Write-Host "NDJSON files to edit: $($ndjsonDeletesByFile.Keys.Count)"

if ($DryRun) {
  if ($jsonDeletes.Count -gt 0) { $jsonDeletes | ForEach-Object { Write-Host "[DRY] delete $_" } }
  foreach ($kvp in $ndjsonDeletesByFile.GetEnumerator()) {
    $path = $kvp.Key; $idx = ($kvp.Value | Sort-Object)
    Write-Host "[DRY] edit $path (remove lines: $([string]::Join(',', $idx)))"
  }
  exit 0
}

# Delete duplicate JSON files
foreach ($path in $jsonDeletes) {
  if (Test-Path $path) {
    Remove-Item $path -Force
    Write-Host "Deleted duplicate JSON: $path"
  }
}

# Edit NDJSON files in one pass per file
foreach ($path in $ndjsonDeletesByFile.Keys) {
  if (-not (Test-Path $path)) { continue }
  $indices = $ndjsonDeletesByFile[$path] | Sort-Object -Descending  # remove from bottom up not strictly needed using filter below
  $arr = Get-Content $path
  $keep = @()
  for ($i=0; $i -lt $arr.Count; $i++) {
    if ($indices.Contains($i)) { continue }
    $keep += $arr[$i]
  }
  Set-Content $path $keep -Encoding utf8NoBOM
  Write-Host "Rewrote NDJSON without duplicate lines: $path (removed $($indices.Count) lines)"
}

Write-Host "UID dedupe complete."
