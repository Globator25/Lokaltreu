# Lokaltreu API Mock (Prism)

## Start (lokal)
npx prism mock apps/api/openapi/lokaltreu-openapi-v2.0.yaml -p 4010

## Verifikation (Examples wirklich ausliefern)
- Prefer: code=XXX erzwingt den HTTP-Statuscode.
- Prefer: example=<exampleName> wählt ein konkretes Example aus.

Beispiele (PowerShell):
curl.exe -i -X POST "http://127.0.0.1:4010/stamps/claim" 
  -H "Content-Type: application/json" 
  -H "Idempotency-Key: idemp_demo_12345678" 
  -H "Prefer: code=403, example=planNotAllowed" 
  -d "{"qrToken":"qr_demo_token","ref":"ref_demo_code"}"

curl.exe -i -X POST "http://127.0.0.1:4010/stamps/claim" 
  -H "Content-Type: application/json" 
  -H "Idempotency-Key: idemp_demo_12345678" 
  -H "Prefer: code=429, example=rate_limited" 
  -d "{"qrToken":"qr_demo_token","ref":"ref_demo_code"}"

 = [int][double]::Parse((Get-Date -UFormat %s))
curl.exe -i -X POST "http://127.0.0.1:4010/rewards/redeem" 
  -H "Content-Type: application/json" 
  -H "X-Device-Key: devkey_demo" 
  -H "X-Device-Timestamp: " 
  -H "X-Device-Proof: proof_demo_base64url" 
  -H "Idempotency-Key: idemp_demo_12345678" 
  -H "Prefer: code=409, example=tokenReuse" 
  -d "{"redeemToken":"reward_demo_token"}"

## Governance
- Keine PII in Examples/Requests (keine E-Mail, Telefon, Namen, Adressen).
- SSOT ist pps/api/openapi/lokaltreu-openapi-v2.0.yaml.
