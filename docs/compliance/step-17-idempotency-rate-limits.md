# Step 17 – Idempotenz & Rate-Limits

## Kurzbeschreibung
Schritt 17 setzt den Schutz vor Duplikaten und Missbrauch für Hot-Routen um. Fokus: Idempotency-Key Pflicht für /stamps/claim und /rewards/redeem, konsistente RFC-7807-Fehlerantworten und nachweisbare Rate-Limits.

## Implementierung Idempotency

**Middleware-Lage**
- `apps/api/src/mw/idempotency.ts`

**Idempotency-Store**
- In-Memory: `InMemoryIdempotencyStore` (Dev/Tests)
- Redis: `apps/api/src/services/idempotencyStore/redis.ts`
- Redis-Client: `apps/api/src/infra/redisClient.ts`
- Store-Auswahl: `createIdempotencyStore()` via `IDEMPOTENCY_STORE` (`memory` Default, `redis` optional)

**Key-Scope**
- Scope: `{ tenantId, routeId, bodyHash, Idempotency-Key }`
- Ableitung: `buildIdempotencyKey()` in `apps/api/src/mw/idempotency.ts`

**TTL & Replay-Policy**
- TTL: 24h (`IDEMPOTENCY_TTL_SECONDS = 86400`)
- Replay-Policy:
  - `status < 500` (2xx + fachliche 4xx/429) → gecached
  - `status >= 500` → nicht gecached, Lock wird freigegeben
  - Replay liefert Status, gespeicherte Header inkl. `Idempotency-Key`, Body

## Rate-Limits

**Globale Limits** (`apps/api/src/config/rate-limits.v1.ts`)
- Tenant: 600 rpm
- IP anonym: 120 rpm

**Route-spezifische Limits** (`apps/api/src/config/rate-limits.v1.ts`)
- `POST /stamps/claim`: 30 rpm / Card
- `POST /rewards/redeem`: 10 rpm / Device

**Middleware**
- `apps/api/src/mw/rate-limit.ts`

**Tests**
- `apps/api/src/mw/__tests__/rate-limit.spec.ts`

## Tests & Lasttests

**Idempotenz-Tests**
- `apps/api/src/mw/__tests__/idempotency-http.spec.ts`
- `apps/api/src/mw/__tests__/idempotency-retry.spec.ts`
- `apps/api/src/mw/__tests__/idempotency-conflict.spec.ts`
- `apps/api/src/mw/__tests__/idempotency-replay-policy.spec.ts`

**Rate-Limit-Tests**
- `apps/api/src/mw/__tests__/rate-limit.spec.ts`

**k6-Skripte**
- Happy-Path: `scripts/k6/stamps-claim-happy.js` (2xx-Only, p95 < 3000 ms, error rate < 1%)
- Rate-Limit: `scripts/k6/stamps-claim-ratelimit.js`
- Rate-Limit/Idempotenz kombiniert: `scripts/k6/stamps-claim-idempotency-rate-limit.js`

## Logs & Anti-Abuse-Nachweis

**Rate-Limit (Beispiel)**
```json
{
  "event": "rate_limit",
  "dimension": "card",
  "routeId": "POST /stamps/claim",
  "retry_after": 12,
  "tenant_id": "tenant-123",
  "card_id": "card-abc",
  "correlation_id": "9b4f9e0a-7a3f-4a38-9b3b-8e65a1af2c4a"
}
```

**Idempotenz Replay (Beispiel)**
```json
{
  "event": "idempotency",
  "action": "replay",
  "routeId": "POST /stamps/claim",
  "tenant_id": "tenant-123",
  "correlation_id": "7d2c8a4b-0db6-4f4c-8b6a-2f4b9b7f5a1e"
}
```

**Idempotenz Conflict (Beispiel)**
```json
{
  "event": "idempotency",
  "action": "conflict",
  "routeId": "POST /stamps/claim",
  "tenant_id": "tenant-123",
  "correlation_id": "5c2b6b45-2fcb-4a0f-93cf-9a4a3e6f02a9"
}
```

## DoD-Mapping (Schritt 17)

| DoD-Aussage | Artefakt | Nachweis |
| --- | --- | --- |
| Idempotency-Key Pflicht für Hot-Routen | `apps/api/src/mw/idempotency.ts` | `isHotRoute()` + `validateIdempotencyKey()` erzwingen Header |
| Rate-Limit-Fehler RFC-7807 + `error_code=RATE_LIMITED` + `Retry-After` | `apps/api/src/mw/rate-limit.ts` | Problem+JSON + Header gesetzt |
| Anti-Abuse-Nachweis (Limits + Logs) | `apps/api/src/mw/rate-limit.ts` | Log-Event `rate_limit` ohne PII |
| Idempotenz-Replay korrekt | `apps/api/src/mw/__tests__/idempotency-replay-policy.spec.ts` | 2xx/4xx cached, 5xx nicht |
| Rate-Limits route-spezifisch | `apps/api/src/config/rate-limits.v1.ts` | Limits für Card/Device definiert |
| k6-Nachweis (p95, 429-Verhalten) | `scripts/k6/stamps-claim-happy.js`, `scripts/k6/stamps-claim-idempotency-rate-limit.js` | Happy-Path p95<3000ms, Rate-Limit 429 sichtbar |

## k6 – Lokale Ausführung (dev)

- Die API muss lokal unter `http://127.0.0.1:<PORT>/v2` erreichbar sein.
- PowerShell (Beispiel): `$env:BASE_URL = "http://127.0.0.1:3001/v2"`.
- `DEVICE_PROOF_HEADERS_JSON` per Env setzen; es ist ein JSON-String mit Device-Proof-Konfiguration.
- Dev-Seed (nur lokal): `API_PROFILE="dev"` und `DEV_SEED="1"` setzen, damit das Test-Device aktiv ist.

## k6-Status & bekannte Einschränkung (dev)

- Idempotenz & Rate-Limits sind technisch umgesetzt und getestet (Middleware + Tests).
- k6 ist an die reale API gebunden (`BASE_URL` auf `http://127.0.0.1:<PORT>/v2`).
- Der aktuelle `TOKEN_REUSE`-Fehler resultiert aus fehlenden echten Device-Proof-Headern in dev und wird in Schritt 16/18 adressiert.
