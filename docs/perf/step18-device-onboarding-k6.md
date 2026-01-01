## Lokaler k6-Debug-Run (Router-/Fallback-Verhalten)

- Script: `scripts/k6/device-onboarding-happy.js`
- BASE_URL = `http://localhost:3000/v2`
- ADMIN_ACCESS_TOKEN = `DUMMY_DEBUG` (nicht gültig)
- Ergebnis (alle 10 Iterationen):

  - CREATE status: `404`
  - CREATE body: Problem+JSON mit:
    - `status`: 404
    - `error_code`: `"TOKEN_REUSE"`
    - `instance`: `"/v2/devices/registration-links"`

- Interpretation:
  - Path `/v2/devices/registration-links` wird vom Router nicht gematcht.
  - Globaler Fallback klassifiziert alle Unknown Routes als `TOKEN_REUSE`.
  - Das ist konsistent mit dem bekannten Bug `/v2/admins/register` und wird in einem separaten Issue adressiert (Routing-/Fallback-Bug, kein Step-18-Backendproblem).
- Hinweis:
  - Für einen „echten“ Device-Onboarding-Performance-Lauf muss später eine Stage-URL verwendet werden, deren Base-Path mit OpenAPI und Router übereinstimmt (ohne `/v2` oder mit Prefix-Stripping).

## Lokaler k6-Run (Step 18, Happy Path)

- Umgebung:
  - BASE_URL = `http://localhost:3000`
  - API_PREFIX = `""`
  - Dev-DB-Modus: `USE_IN_MEMORY_DB=true`, `DEVICE_REPOSITORY_MODE=memory`
- Szenario:
  - Script: `scripts/k6/device-onboarding-happy.js`
  - VUs: `10`
  - Iterationen: `10`
  - Auth: `ADMIN_ACCESS_TOKEN` via `/admins/login`
- Ergebnisse:
  - http_req_failed = `0 / 20` (0% Fehler)
  - http_req_duration p(95) ≈ `20.38 ms`
  - Checks: `create returns 201`, `create returns token`, `confirm returns 204` gruen
- Summary:
  - `artifacts/k6/step18-local-summary.json`
