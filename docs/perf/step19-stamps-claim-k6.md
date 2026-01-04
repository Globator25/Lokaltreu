## Schritt 19: k6 Mini-Lasttests (Stempelvergabe)

- Scripts:
  - `scripts/k6/stamps-claim-happy.js` (p95-Messung Happy-Path)
  - `scripts/k6/stamps-claim-idempotency-rate-limit.js` (Idempotency + Rate-Limit)
  - `scripts/k6/stamps-claim-ratelimit.js` (Rate-Limit Fokus)
  - `scripts/k6/stamps-claim-token-reuse-error.js` (TOKEN_REUSE-Fehlerpfad)

## Lokaler k6-Run (Happy Path)

- BASE_URL = `http://localhost:3000`
- API_PREFIX = `""`
- Für Token-Erzeugung via `/stamps/tokens` wird Device-Proof benötigt:
  - `DEVICE_PROOF_HEADERS_JSON` setzen (siehe Script-Kommentare)
  - Alternativ `QR_TOKENS` als Komma-Liste vorkonfigurierter Tokens

## Token-Reuse Szenario

- Script: `scripts/k6/stamps-claim-token-reuse-error.js`
- Erfordert `QR_TOKEN` (ein QR-Token, das bereits einmal eingelöst wurde).
- Optional `PRE_CLAIM=false`, falls der Token bereits vorab konsumiert wurde.

## Ergebnisse

- Noch nicht ausgeführt (Stage-p95 < 3s gemäß DoD).
