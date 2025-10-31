Param(
  [string]$Root = "."
)

# Präzise Non-EU Regionstokens (vermeidet "US" im Fließtext):
#  - us-*, ap-*, sa-*, au-*, me-*, ca-*, af-*, oc-*
#  - Kurzformen wie use1/use2/usw1/usw2
$deny = @(
  '(?i)\b(?:us|ap|sa|au|me|ca|af|oc)-[a-z0-9-]+\b',
  '(?i)\b(?:use1|use2|usw1|usw2)\b'
)

# Provider-Allowlists
$allow = @{
  fly     = '^(ams|cdg|fra|lhr|arn)$'
  neon    = '^(aws-eu-central-1|aws-eu-west-2|azure-gwc)$'
  upstash = '^eu-(central-1|west-1|west-2)$'
  r2hint  = '^(weur|eeur)$'
  r2jur   = '^eu$'
}

# Nur Terraform-Code scannen, problematische Verzeichnisse ausschließen
$files = Get-ChildItem -Path $Root -Recurse -File -Include *.tf,*.tfvars |
  Where-Object {
    $_.FullName -notmatch '\\(node_modules|\.terraform|\.git|\.github|docs)\\'
  }

$errors = @()

foreach ($f in $files) {
  $t = Get-Content $f.FullName -Raw

  foreach ($pat in $deny) {
    if ($t -match $pat) { $errors += "Non-EU match: $($f.FullName) -> $($Matches[0])" }
  }

  if ($t -match 'fly_primary_region\s*=\s*"([^"]+)"') {
    if ($Matches[1] -notmatch $allow.fly) { $errors += "Fly non-EU: $($f.FullName) -> $($Matches[1])" }
  }
  if ($t -match 'neon_region\s*=\s*"([^"]+)"') {
    if ($Matches[1] -notmatch $allow.neon) { $errors += "Neon non-EU: $($f.FullName) -> $($Matches[1])" }
  }
  if ($t -match 'r2_location_hint\s*=\s*"([^"]+)"') {
    if ($Matches[1] -notmatch $allow.r2hint) { $errors += "R2 hint non-EU: $($f.FullName) -> $($Matches[1])" }
  }
  if ($t -match 'r2_jurisdiction\s*=\s*"([^"]+)"') {
    if ($Matches[1] -notmatch $allow.r2jur) { $errors += "R2 jur non-EU: $($f.FullName) -> $($Matches[1])" }
  }
  if ($t -match 'upstash_redis_url\s*=\s*"([^"]+)"') {
    if ($Matches[1] -notmatch '^https?://eu-') { $errors += "Upstash URL nicht EU: $($f.FullName) -> $($Matches[1])" }
  }
}

if ($errors.Count) {
  $errors | ForEach-Object { Write-Error $_ }
  exit 2
} else {
  Write-Host "EU-Whitelist: OK"
}
