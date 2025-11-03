param(
  [string]$Root   = "infra\terraform",
  [string]$Policy = "infra\policies\eu-regions.json"
)

$policy     = Get-Content $Policy -Raw | ConvertFrom-Json
$tfFiles    = Get-ChildItem -Path $Root -Recurse -Include *.tf,*.tfvars -ErrorAction SilentlyContinue
$violations = @()

function Add-Violation($file, $msg) {
  $script:violations += [pscustomobject]@{ File = $file; Issue = $msg }
}

foreach ($f in $tfFiles) {
  $text = Get-Content $f.FullName -Raw

  # ---------- Fly.io ----------
  if ($text -match '(?s)fly_|provider\s+"fly"') {
    $flyMatches = [regex]::Matches($text, '(?mi)^\s*(primary_region|region)\s*=\s*"([a-z]{3})"\s*$')
    foreach ($m in $flyMatches) {
      $val = $m.Groups[2].Value.Trim()
      if ($policy.fly -notcontains $val) {
        Add-Violation $f.FullName "Fly-Region nicht whitelisted: $val"
      }
    }
  }

  # ---------- Neon ----------
  if ($text -match '(?s)neon_|provider\s+"neon"') {
    $neonMatches = [regex]::Matches($text, '(?mi)^\s*(region|region_id)\s*=\s*"([^"]+)"\s*$')
    foreach ($m in $neonMatches) {
      $val = $m.Groups[2].Value.Trim()
      if ($policy.neon -notcontains $val) {
        Add-Violation $f.FullName "Neon-Region nicht whitelisted: $val"
      }
    }
  }

  # ---------- Upstash ----------
  if ($text -match 'upstash_' -or $text -match '(?mi)^\s*provider\s+"upstash"') {
    $upMatches = [regex]::Matches($text, '(?mi)^\s*region\s*=\s*"([^"]+)"\s*$')
    foreach ($m in $upMatches) {
      $val = $m.Groups[1].Value.Trim()
      if ($policy.upstash -notcontains $val) {
        Add-Violation $f.FullName "Upstash-Region nicht whitelisted: $val"
      }
    }
  }

  # ---------- Cloudflare R2 ----------
  if (($f.Extension -eq '.tf') -and ($text -match '(?s)resource\s+"cloudflare_.*r2.*"\s+"[^"]+"')) {
    $jur = [regex]::Match($text, '(?mi)^\s*jurisdiction\s*=\s*"([^"]+)"\s*$')
    if (-not $jur.Success) {
      Add-Violation $f.FullName "R2: jurisdiction fehlt (muss 'eu' sein)"
    }
    elseif ($jur.Groups[1].Value.Trim().ToLower() -ne 'eu') {
      Add-Violation $f.FullName ("R2: jurisdiction nicht 'eu' sondern '{0}'" -f $jur.Groups[1].Value)
    }
  }
}

if ($violations.Count) {
  $violations | Sort-Object File, Issue | Format-Table -AutoSize
  Write-Error ("EU-Region Policy verletzt in {0} Datei(en)." -f $violations.Count)
  exit 2
}
else {
  Write-Host "EU-Region Policy: OK"
}
