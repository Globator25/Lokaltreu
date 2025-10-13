$ErrorActionPreference = 'Stop'

# Repo-wide BOM check for text config files
$patterns = '*.yaml','*.yml','*.json','*.ndjson','*.toml'
$files = Get-ChildItem -Recurse -File -Include $patterns
$withBom = foreach ($f in $files) {
  try {
    $b = [IO.File]::ReadAllBytes($f.FullName)
    if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { $f.FullName }
  } catch {}
}
if ($withBom) {
  Write-Host 'BOM gefunden in:' -ForegroundColor Red
  $withBom | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  exit 1
} else {
  Write-Host 'OK: Alle Dateien utf8NoBOM' -ForegroundColor Green
}

# Mandatory provider file specific check
$p = 'apps/obs/grafana/provisioning/dashboards/provider.yaml'
if (-not (Test-Path $p)) {
  Write-Warning "Provider file not found: $p"
} else {
  $bytes = [IO.File]::ReadAllBytes($p)
  if ($bytes.Length -ge 3 -and $bytes[0..2] -ceq 0xEF,0xBB,0xBF) {
    throw "BOM in $p"
  } else {
    Write-Host "OK: $p utf8NoBOM" -ForegroundColor Green
  }
}

# UID dedupe verification (read-only)
$dash = 'apps/obs/grafana/provisioning/dashboards/lokaltreu'
if (-not (Test-Path $dash)) {
  Write-Host "Dashboards path not found (skip UID check): $dash" -ForegroundColor Yellow
  exit 0
}

# JSON files: duplicate uid
$filesJson = Get-ChildItem $dash -Recurse -Include *.json -File
$uids = foreach ($f in $filesJson) {
  try {
    $j = Get-Content $f -Raw | ConvertFrom-Json -ErrorAction Stop
    if ($j.uid) { [pscustomobject]@{ File=$f.FullName; Uid=$j.uid } }
  } catch {}
}
$dupsJson = $uids | Group-Object Uid | Where-Object Count -gt 1
if ($dupsJson) {
  Write-Host 'Duplikate (JSON):' -ForegroundColor Red
  $dupsJson | ForEach-Object { $_.Group | Select-Object Uid,File | Format-Table -AutoSize | Out-String | Write-Host }
  exit 1
} else {
  Write-Host 'OK: Keine doppelten uid in JSON' -ForegroundColor Green
}

# NDJSON files: duplicate uid by line
$filesNd = Get-ChildItem $dash -Recurse -Include *.ndjson -File
$badNd = @()
foreach ($f in $filesNd) {
  $lines = (Get-Content $f -Raw -Encoding UTF8 ) -split "`n"
  $uidsNd = foreach ($ln in $lines) {
    if (-not [string]::IsNullOrWhiteSpace($ln)) {
      try {
        $o = $ln | ConvertFrom-Json -ErrorAction Stop
        if ($o.uid) { $o.uid } elseif ($o.dashboard.uid) { $o.dashboard.uid }
      } catch {}
    }
  }
  if ($uidsNd) {
    $dups = $uidsNd | Group-Object | Where-Object Count -gt 1
    if ($dups) { $badNd += [pscustomobject]@{ File=$f.FullName; Duplicates=($dups.Name -join ', ') } }
  }
}
if ($badNd.Count -gt 0) {
  Write-Host 'Duplikate (NDJSON):' -ForegroundColor Red
  $badNd | ForEach-Object { "{0} => {1}" -f $_.File, $_.Duplicates } | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  exit 1
} else {
  Write-Host 'OK: Keine doppelten uid in NDJSON' -ForegroundColor Green
}


