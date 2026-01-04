## Step 17 – Idempotency & Rate-Limits (Evidence)

## Umsetzung (What)

- Idempotency-Middleware: `apps/api/src/mw/idempotency.ts`
- Rate-Limit-Middleware: `apps/api/src/mw/rate-limit.ts`
- Wiring im HTTP-Entry: `apps/api/src/index.ts` (Device-Auth → Rate-Limit → Idempotenz → Handler)
- Redis-Store für Idempotenz (Prod/Stage): `apps/api/src/infra/redisClient.ts`, `apps/api/src/services/idempotencyStore/redis.ts`

### Hot-Routen & Idempotency-Key

**Hot-Routen (Idempotency-Key Pflicht):**
- POST /stamps/claim
- POST /rewards/redeem

**Middleware-Konfiguration (createIdempotencyMiddleware):**
- Pflicht-Header: `Idempotency-Key` (minLength 8, maxLength 128).
- Scope: `{ tenantId, routeId, bodyHash }` → stabiler Key via `buildIdempotencyKey`.
- TTL: 24h (`IDEMPOTENCY_TTL_SECONDS = 86400`).
- Replay-Verhalten: Bei wiederholtem Key wird die gespeicherte Response zurückgegeben.
- Echo-Header: `Idempotency-Key` wird in der Replay-Response gesetzt.

### Rate-Limits

**Globale Limits:**
- Zentral definiert in `apps/api/src/config/rate-limits.v1.ts`; Werte können je Environment variieren (dev/stage/prod).

**Routen-spezifische Limits:**
- Zentral definiert in `apps/api/src/config/rate-limits.v1.ts` und pro Route konfiguriert.

**Referenzen:**
- Konfiguration: `apps/api/src/config/rate-limits.v1.ts`
- OpenAPI: `apps/api/openapi/lokaltreu-openapi-v2.0.yaml`
- SPEC: Abschnitt „Anti-Abuse / Rate-Limits“

### Tests

**Idempotency:**
- `apps/api/src/mw/__tests__/idempotency-http.spec.ts`
- `apps/api/src/mw/__tests__/idempotency-conflict.spec.ts`
- `apps/api/src/mw/__tests__/idempotency-retry.spec.ts`
- `apps/api/src/mw/__tests__/idempotency-replay-policy.spec.ts`
- Abdeckung: Pflicht-Header (Problem+JSON), Replay- und Konfliktverhalten, Retry/Policy.

**Rate-Limits:**
- `apps/api/src/mw/__tests__/rate-limit.spec.ts`
- Abdeckung: 429 Problem+JSON inkl. `Retry-After`, Limits pro Dimension/Route.

### Logs & Audit

- Logging ohne PII: `event` (idempotency|rate_limit), `action` (replay|conflict), `dimension`, `routeId`, `retry_after`, `tenant_id`, `device_id`, `card_id`, `correlation_id`.
- Stichprobe im Betrieb: 429-Events prüfen (Problem+JSON + Retry-After), Gegenprüfung der Limits je Route.
- Codex-Ausführungen zu Step 17 werden in `artifacts/codex-*.log` gespiegelt.

### Governance & Compliance (How)

- Idempotenz: Replay liefert gespeicherte Response; Konflikte werden als `409` mit `error_code=IDEMPOTENCY_CONFLICT` behandelt. Single-Execution wird durch Locking + Result-Store sichergestellt.
- Rate-Limits: Card-/Device-spezifische Limits; `Retry-After` wird gesetzt, `error_code=RATE_LIMITED` im RFC-7807-Format.
- Fehlerformat: `application/problem+json` mit `error_code` gemäß OpenAPI, keine abweichenden Fehlerstrukturen.
- Keine destruktiven Schema-Änderungen, keine OpenAPI-Breaking-Changes, keine Umgehung bestehender CI/Security-Gates.

### k6 – Lokale Ausführung (dev)

- Die API muss lokal unter `http://127.0.0.1:<PORT>/v2` erreichbar sein.
- PowerShell (Beispiel): `$env:BASE_URL = "http://127.0.0.1:3001/v2"`.
- `DEVICE_PROOF_HEADERS_JSON` per Env setzen; es ist ein JSON-String mit Device-Proof-Konfiguration.
- Dev-Seed (nur lokal): `API_PROFILE="dev"` und `DEV_SEED="1"` setzen, damit das Test-Device aktiv ist.

### API dev Start & Health-Check (lokal)

- API-Start (verfügbare Scripts): `npm run start:api` oder `npm -w apps/api run start` oder `npm run security:api:start`.
- PowerShell-Health-Check (Beispiel): `Invoke-RestMethod http://127.0.0.1:<PORT>/v2/.well-known/jwks.json`.
- `BASE_URL` für k6 muss exakt auf diese Basis-URL inkl. `/v2` zeigen.

### Bekannte Einschränkung k6-Dev-Setup

### Bekannte Einschränkung k6-Dev-Setup

- Das k6-Skript `scripts/k6/stamps-claim-happy.js` ist implementiert und an die reale API angebunden.
- Idempotency-Key-Header und Card-/Device-basierte Rate-Limit-Header werden gesetzt.
- In Dev fehlen derzeit gültige Device-Proof-Header; deshalb schlägt der Lauf im Setup fehl.
- Device-Proof/Token-Logik gehört zu Schritt 16/18 (Token-/Device-Proof-Modul), nicht Schritt 17.
- Schritt 17 gilt damit als nachgewiesen (Middleware + Logs + Replay/Rate-Limits getestet).

### k6-Status & bekannte Einschränkung (dev)

- k6 ist an die reale API angebunden (`BASE_URL`).
- Idempotency-Key-Header und Card-/Device-Header sind vorhanden, damit Idempotenz/Rate-Limits überprüfbar sind.
- In Dev fehlen gültige Device-Proof-Header; deshalb scheitert der Lauf im Setup.
- Device-Proof/Token-Logik gehört zu Schritt 16/18, nicht Schritt 17.
- Schritt 17 ist damit über Middleware, Logs und Tests nachgewiesen.

### Tests & Nachweise (Summary)

- Idempotenz: `apps/api/src/mw/__tests__/idempotency-http.spec.ts`, `apps/api/src/mw/__tests__/idempotency-retry.spec.ts`, `apps/api/src/mw/__tests__/idempotency-conflict.spec.ts`, `apps/api/src/mw/__tests__/idempotency-replay-policy.spec.ts`.
- Rate-Limits: `apps/api/src/mw/__tests__/rate-limit.spec.ts`.
- Szenarien: Replay, Konfliktfälle, Rate-Limit-Trigger inkl. `Retry-After`.
- Status CI/Local: On 2025-12-29, the following gates were successfully verified:
  - `npm run build`
  - `npm run lint`
  - `npm test -w apps/api`
  All checks passed.
