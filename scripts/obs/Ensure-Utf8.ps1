[CmdletBinding()]
param(
  [Parameter(Mandatory, Position=0)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$target = Resolve-Path -LiteralPath $Path -ErrorAction Stop
$items  = if ((Get-Item -LiteralPath $target).PSIsContainer) {
  Get-ChildItem -LiteralPath $target -Recurse -Include *.toml,*.yaml,*.yml -File
} else {
  Get-Item -LiteralPath $target
}

foreach ($f in $items) {
  $raw = Get-Content -LiteralPath $f.FullName -Raw
  Set-Content -LiteralPath $f.FullName -Value $raw -Encoding utf8NoBOM
  Write-Output "UTF-8 ohne BOM: $($f.FullName)"
}
