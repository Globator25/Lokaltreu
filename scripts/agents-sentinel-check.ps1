Param()
$path = Join-Path $PSScriptRoot "..\AGENTS.md"
if (!(Test-Path $path)) { Write-Error "AGENTS.md fehlt"; exit 1 }
if (-not (Select-String -Path $path -Quiet -Pattern "\[SENTINEL:ENABLED\]")) {
  Write-Error "Sentinel fehlt in AGENTS.md"; exit 1
}
exit 0
