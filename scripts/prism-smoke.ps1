param(
  [int]$Port = 4013,
  [switch]$StartPrism,
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"

function Test-PortOpen {
  param(
    [Parameter(Mandatory = $true)][string]$Host,
    [Parameter(Mandatory = $true)][int]$Port
  )
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect($Host, $Port)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-ForPort {
  param(
    [Parameter(Mandatory = $true)][string]$Host,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][int]$TimeoutSec
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen -Host $Host -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

$baseUrl = "http://localhost:$Port"
$npmProcess = $null
$startedByScript = $false

if ($StartPrism -and -not (Test-PortOpen -Host "127.0.0.1" -Port $Port)) {
  $npmProcess = Start-Process -FilePath "npm" -ArgumentList @(
    "--workspaces=false",
    "run",
    "prism:mock",
    "--",
    "$Port"
  ) -PassThru
  $startedByScript = $true
}

try {
  if (-not (Wait-ForPort -Host "127.0.0.1" -Port $Port -TimeoutSec $TimeoutSec)) {
    throw "Prism not reachable on port $Port within $TimeoutSec seconds."
  }

  $summaryUrl = "$baseUrl/admins/reporting/summary"
  $timeseriesUrl = "$baseUrl/admins/reporting/timeseries?metric=stamps&bucket=day"

  $summaryResponse = Invoke-RestMethod -Uri $summaryUrl -Method Get -ContentType "application/json"
  $timeseriesResponse = Invoke-RestMethod -Uri $timeseriesUrl -Method Get -ContentType "application/json"

  if (-not $summaryResponse.stamps) {
    throw "Missing summary.stamps"
  }
  if ($timeseriesResponse.metric -ne "stamps") {
    throw "timeseries.metric mismatch"
  }
  if ($timeseriesResponse.bucket -ne "day") {
    throw "timeseries.bucket mismatch"
  }

  $summaryResponse | ConvertTo-Json -Depth 20
  $timeseriesResponse | ConvertTo-Json -Depth 20

  exit 0
} catch {
  Write-Error $_
  exit 1
} finally {
  if ($startedByScript -and $npmProcess -and -not $npmProcess.HasExited) {
    Stop-Process -Id $npmProcess.Id -Force
  }
}
