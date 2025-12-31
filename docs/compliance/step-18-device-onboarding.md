# Step 18 – Geräte-Onboarding

## Kurzbeschreibung
Schritt 18 implementiert das sichere Onboarding von Mitarbeiter-Geräten über einmalige Registrierungs-Links (Magic Links). Ziel ist ein einfacher, auditierbarer Flow ohne Klartext-Token in der Datenbank.

## Datenmodell

**Neue Tabelle**
- `device_registration_links` (Migration: `apps/api/db/migrations/0002_step18_device_registration_links.sql`)

**Wichtige Spalten**
- `token_hash` (SHA-256, **kein** Klartext-Token in der DB)
- `expires_at` (TTL, Ablaufprüfung im Service)
- `used_at` (Einmaligkeit)
- `tenant_id` (Tenant-Scoping)
- `device_id` nullable, `ON DELETE SET NULL` (DSR/Tombstone-kompatibel)
- `created_by_admin_id` nullable (Audit-Zuordnung)

## API-Endpunkte (OpenAPI 3.1)

**POST /devices/registration-links**
- AdminAuth-geschützt
- erzeugt einen Link + Token (Token nur im Response)
- Response 201 gemäß `DeviceRegistrationLinkResponse`

**POST /devices/register/confirm**
- Magic-Link-Confirm (security: [])
- Request: `{ token: string }`
- Response 204 bei Erfolg
- Fehler RFC 7807: `TOKEN_EXPIRED` (400), `TOKEN_REUSE` (409)

## Sicherheit & Compliance

- Admin-Auth für Link-Erstellung (Admin-Kontext erforderlich)
- Token-Einmaligkeit: `used_at` und Hash-basiertes Lookup
- Ablaufprüfung: `expires_at`
- Fehlerformat: RFC 7807 / Problem+JSON
- Logs ohne PII (nur tenant_id, device_id; kein Token/Hash)

## Tests & Nachweise

**HTTP-Integrationstests**
- `apps/api/src/device-onboarding.http.spec.ts` (Happy Path + Token-Reuse)

**Security/Idempotency/Rate-Limits**
- `apps/api/src/mw/idempotency.ts` + Tests in `apps/api/src/mw/__tests__/`
- `apps/api/src/mw/rate-limit.ts` + Tests in `apps/api/src/mw/__tests__/`
- Security-Gates: `npm run test:security:anti-replay`, `npm run test:security:device-proof`

**Build/Contract**
- Lint/Build/Tests via CI (siehe `docs/CI-Gates.md`)
- OpenAPI Contract-Check: `npm run contract:check`

## Migration (Expand-Only)

- `0002_step18_device_registration_links.sql` ist **expand-only**
- keine Drops/Umbenennungen, keine Breaking Changes für bestehende Tabellen/Flows
