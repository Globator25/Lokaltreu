# Local-only DEV script for rate-limit verification (POST /stamps/claim).

$limit = 3
$baseUrl = "http://localhost"
$path = "/stamps/claim"
$cardId = "card-local-1"

for ($i = 1; $i -le ($limit + 2); $i++) {
  $idempotencyKey = "rl-claim-$i-$(Get-Random)"
  $body = @{
    qrToken = "token-$i"
    ref = $null
  } | ConvertTo-Json -Depth 5

  Write-Host "[$i] POST $path (Idempotency-Key: $idempotencyKey)"

  $response = curl.exe -sS -D - -o - `
    -H "Content-Type: application/json" `
    -H "Idempotency-Key: $idempotencyKey" `
    -X POST "$baseUrl$path" `
    -d $body

  $headers, $payload = $response -split "\r?\n\r?\n", 2
  $statusLine = ($headers -split "\r?\n")[0]
  $retryAfter = ($headers -split "\r?\n" | Where-Object { $_ -match "^Retry-After:" })

  Write-Host "  $statusLine"
  if ($retryAfter) {
    Write-Host "  $retryAfter"
  }
  if ($payload) {
    $snippet = if ($payload.Length -gt 200) { $payload.Substring(0, 200) + "..." } else { $payload }
    Write-Host "  Body: $snippet"
  }
}
