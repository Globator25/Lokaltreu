param(
  [string]$PlanJson = "infra\terraform\tfplan.json",
  [string]$Policy   = "infra\policies\eu-regions.json"
)
$policy = Get-Content $Policy -Raw | ConvertFrom-Json
$plan   = Get-Content $PlanJson -Raw | ConvertFrom-Json
$viol   = @()

foreach($rc in $plan.resource_changes){
  $after = $rc.change.after
  if(-not $after){ continue }
  $type = $rc.type

  if($type -like 'upstash_*' -and $after.PSObject.Properties.Name -contains 'region'){
    if($policy.upstash -notcontains ($after.region.Trim())){
      $viol += "$($rc.address): Upstash $($after.region)"
    }
  }
  if($type -like 'cloudflare_*r2*'){
    if(-not $after.jurisdiction){
      $viol += "$($rc.address): R2 jurisdiction fehlt"
    } elseif(($after.jurisdiction.ToString().Trim().ToLower()) -ne 'eu'){
      $viol += "$($rc.address): R2 jurisdiction=$($after.jurisdiction)"
    }
  }
  if($type -like 'neon_*' -and $after.PSObject.Properties.Name -contains 'region'){
    if($policy.neon -notcontains ($after.region.Trim())){
      $viol += "$($rc.address): Neon $($after.region)"
    }
  }
}

if($viol.Count){
  $viol | ForEach-Object { Write-Host $_ }
  exit 3
}else{
  Write-Host "tfplan EU-Check: OK"
}
