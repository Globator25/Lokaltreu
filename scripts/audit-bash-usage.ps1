$ErrorActionPreference = 'Stop'

Write-Host "Scanning for shell scripts (*.sh) and bash usage in package.json files..." -ForegroundColor Cyan

$shFiles = Get-ChildItem -Recurse -Filter *.sh -File -ErrorAction SilentlyContinue
if ($shFiles) {
  Write-Host ("Found {0} .sh files:" -f $shFiles.Count) -ForegroundColor Green
  $shFiles | Select-Object -ExpandProperty FullName
} else {
  Write-Host "No .sh files found."
}

$pkgFiles = Get-ChildItem -Recurse -Filter package.json -File -ErrorAction SilentlyContinue
if ($pkgFiles) {
  Write-Host ("Searching {0} package.json for 'bash' or 'sh -c'..." -f $pkgFiles.Count) -ForegroundColor Green
  $matches = Select-String -Path ($pkgFiles | Select-Object -ExpandProperty FullName) -Pattern "bash|sh -c" -SimpleMatch -CaseSensitive:$false -ErrorAction SilentlyContinue
  if ($matches) {
    $matches | ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
  } else {
    Write-Host "No bash usage strings found in package.json files."
  }
} else {
  Write-Host "No package.json files found."
}
