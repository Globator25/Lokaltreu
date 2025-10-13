$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
  [Parameter(Mandatory=$true)][string]$Path
)

if (-not (Test-Path $Path)) {
  throw "Path not found: $Path"
}

$isDir = Test-Path $Path -PathType Container
if ($isDir) {
  Get-ChildItem -Recurse -File -Path $Path -Include *.toml,*.yaml,*.yml | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    Set-Content -Path $_.FullName -Value $content -Encoding utf8NoBOM
    Write-Host "Rewrote (UTF-8 no BOM): $($_.FullName)" -ForegroundColor Green
  }
} else {
  $content = Get-Content $Path -Raw
  Set-Content -Path $Path -Value $content -Encoding utf8NoBOM
  Write-Host "Rewrote (UTF-8 no BOM): $Path" -ForegroundColor Green
}

