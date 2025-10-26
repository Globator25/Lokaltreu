[CmdletBinding()]
param(
  [Parameter()][string]$App     = 'lokaltreu-obs-loki',
  [Parameter()][string]$Tenant  = 'lokaltreu',
  [Parameter()][string]$Message = 'hello from PowerShell',
  [Parameter()][switch]$UseCurlFirst
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ns    = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000L).ToString()
$url   = "https://$App.fly.dev/loki/api/v1/push"
$headers = @{ 'X-Scope-OrgID' = $Tenant }

$payload = [ordered]@{
  streams = @(
    @{ stream = @{ app = 'smoke'; tenant = $Tenant }
       values = @(@([string]$ns, $Message)) }
  )
}
$body = $payload | ConvertTo-Json -Depth 10 -Compress

function Invoke-WithCurl {
  param([string]$Body,[string]$Url,[hashtable]$Headers)
  $curl = Get-Command 'curl.exe' -CommandType Application -ErrorAction SilentlyContinue
  if (-not $curl) { return $false }
  $tmp = New-TemporaryFile
  try {
    Set-Content -LiteralPath $tmp -Value $Body -Encoding UTF8
    $args = @('-sS','-4','--http1.1','--max-time','30',"-H","Content-Type: application/json")
    foreach($kv in $Headers.GetEnumerator()) { $args += @('-H',"$($kv.Key): $($kv.Value)") }
    $args += @('--data-binary',"@$tmp",$Url)
    $result = & $curl.Source @args
    Write-Output $result
    return $true
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

function Invoke-WithPowerShell {
  param([string]$Body,[string]$Url,[hashtable]$Headers)
  Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers `
    -ContentType 'application/json; charset=utf-8' -Body $Body `
    -SslProtocol Tls12 -MaximumRedirection 0 -DisableKeepAlive -TimeoutSec 30 | Out-Null
}

if ($UseCurlFirst) {
  if (-not (Invoke-WithCurl -Body $body -Url $url -Headers $headers)) {
    Write-Host 'curl.exe not found – falling back to Invoke-RestMethod' -ForegroundColor Yellow
    Invoke-WithPowerShell -Body $body -Url $url -Headers $headers
  }
} else {
  try {
    Invoke-WithPowerShell -Body $body -Url $url -Headers $headers
  } catch {
    Write-Warning "Invoke-RestMethod failed: $($_.Exception.Message)"
    if (-not (Invoke-WithCurl -Body $body -Url $url -Headers $headers)) {
      throw
    }
  }
}

Write-Host "Pushed log to Loki ($App) for tenant '$Tenant'" -ForegroundColor Green

