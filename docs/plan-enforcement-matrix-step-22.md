# Plan-Enforcement-Matrix – Schritt 22

Diese Matrix beschreibt, **wo** Plan-Checks greifen,  
**welcher Typ** von Enforcement gilt  
und **welche Antwort** zurückgegeben wird.


## Übersichtstabelle

| Route / Use-Case | Hot-Route | Feature | Limit-Typ | Enforcement-Point | Verhalten bei Verstoß |
|------------------|:---------:|--------|----------|------------------|----------------------|
| **GET /referrals/link** | Nein | referral (Plan ≥ Plus) | Feature-Gate | Middleware vor Handler | 403 PLAN_NOT_ALLOWED |
| **POST /stamps/claim (mit ref)** | Ja | referral (Plan ≥ Plus) | Feature-Gate | im Claim-Flow, vor Bonus | 403 PLAN_NOT_ALLOWED |
| **POST /stamps/claim (ohne ref)** | Ja | — | Soft-Limit | nach Commit (best effort) | kein Block — nur Warnsignal |
| **POST /devices/register/confirm** | Nein | — | Device-Limit | vor Commit der Aktivierung | 403 PLAN_NOT_ALLOWED |
| **POST /stamps/tokens** | Nein | — | — | — | kein Plan-Block |
| **POST /rewards/redeem** | Ja | offen | offen | offen | tbd |


## Contract-Gaps (additiv geschlossen)

- `/referrals/link` → 403 PLAN_NOT_ALLOWED dokumentiert  
- `/devices/register/confirm` → 403 PLAN_NOT_ALLOWED dokumentiert


## Kanonisches Problem+JSON für Plan-Verstöße

```json
{
  "type": "https://errors.lokaltreu.example/plan/not-allowed",
  "title": "Plan not allowed",
  "status": 403,
  "error_code": "PLAN_NOT_ALLOWED",
  "correlation_id": "<UUID>",
  "instance": "<route>"
}

Beispiele
Referral-Gate
{
  "status": 403,
  "error_code": "PLAN_NOT_ALLOWED",
  "instance": "/referrals/link"
}

Device-Limit
{
  "status": 403,
  "error_code": "PLAN_NOT_ALLOWED",
  "instance": "/devices/register/confirm",
  "detail": "Device limit exceeded for current plan."
}

Soft-Limit (nicht blockierend)

kein Error-Response

Claim bleibt 200

Signale ausschließlich über:

Metrics
Audit-Events
E-Mail / UI-Banner


Eine optionale Contract-Erweiterung (z. B. planNotice) wäre ein eigenes Ticket.


## Nächster Schritt (empfohlen)

1️⃣ Lege die Dateien an:  



docs/plan-enforcement-spec-step-22.md
docs/plan-enforcement-matrix-step-22.md


2️⃣ Kopiere die Inhalte oben hinein.  
3️⃣ Commit & Push.


Wenn du möchtest, helfe ich dir jetzt beim nächsten Schritt:

👉 **„Code gegen Spec & Matrix prüfen“**  
oder  
👉 **„Automatische Tests aus diesen Dokumenten ableiten“**

Sag einfach, womit wir weitermachen.

## Implementierungsstatus (Stand: 07.01.2026)

- Plan-Gate Middleware umgesetzt (plan-gate.ts).
- Referral-Handler und Claim-Handler nutzen Plan-Gates.
- Soft-Limit-Logik für Stempel implementiert (79/80/100 %, dedupliziert).
- Device-Limit bei /devices/register/confirm implementiert.
- Tests:
  - tests/plan/plan-gate-referrals.spec.ts
  - tests/plan/plan-gate-claim-referral.spec.ts
  - tests/plan/plan-soft-limits.spec.ts
  - tests/plan/plan-device-limit.spec.ts
- Alle genannten Tests grün.

## Manual verification (Harness)

Diese manuelle Verifikation ergänzt die automatisierten Vitest-Checks und dient als schneller, nachvollziehbarer Smoke-Test für das Plan-Enforcement (Referral-Gate) gemäß Schritt 22.

Port variiert pro Start; BASE_URL aus Terminal 1 übernehmen.

### Terminal 1 (Harness starten)

```powershell
cd C:\Users\user\Projects\Lokaltreu-clean\apps\api
$env:TS_NODE_TRANSPILE_ONLY="true"
$env:HARNESS_TENANT1_PLAN="starter"
npm run dev:harness:referrals
```

### Terminal 2 (Requests)

```powershell
$baseUrl = "http://127.0.0.1:<PORT>"
# Beispiel:
# $baseUrl = "http://127.0.0.1:59622"

# tenant-1 (starter) -> 403 PLAN_NOT_ALLOWED
curl.exe -i `
  -H "x-test-tenant-id: tenant-1" `
  -H "x-test-card-id: card-1" `
  "$baseUrl/referrals/link"

# x-test-no-context -> 401 Unauthorized
curl.exe -i `
  -H "x-test-no-context: 1" `
  "$baseUrl/referrals/link"

# tenant-2 (plus) -> 200 OK
curl.exe -i `
  -H "x-test-tenant-id: tenant-2" `
  -H "x-test-card-id: card-1" `
  "$baseUrl/referrals/link"
```

### Erwartete Resultate

- tenant-1 (starter) → 403 PLAN_NOT_ALLOWED, `application/problem+json`, `correlation_id`
- x-test-no-context → 401 Unauthorized
- tenant-2 (plus) → 200 OK
