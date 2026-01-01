# Step 18 – Geräte-Onboarding

## Kurzbeschreibung
Schritt 18 implementiert das sichere Onboarding von Mitarbeiter-Geräten über einmalige Registrierungs-Links („Magic Links“).  
Ziel ist ein einfacher, nachvollziehbarer Flow **ohne Speicherung von Klartext-Tokens** in der Datenbank.

## Datenmodell

**Neue Tabelle**
- `device_registration_links`  
  (Migration: `apps/api/db/migrations/0002_step18_device_registration_links.sql`)

**Wichtige Spalten**
- `token_hash` (SHA-256, **kein** Klartext-Token in der DB)
- `expires_at` (TTL, Ablaufprüfung im Service)
- `used_at` (Einmaligkeit)
- `tenant_id` (Tenant-Scoping)
- `device_id` – nullable, `ON DELETE SET NULL` (DSR-/Tombstone-kompatibel)
- `created_by_admin_id` – nullable (Audit-Zuordnung)

## API-Endpunkte (OpenAPI 3.1)

### POST /devices/registration-links
- AdminAuth-geschützt  
- erzeugt einen Registrierungs-Link inkl. Token (**Token nur im Response**)
- Response: `201 Created` gemäß `DeviceRegistrationLinkResponse`

### POST /devices/register/confirm
- Magic-Link-Bestätigung (security: `[]`)
- Request: `{ token: string }`
- Response: `204 No Content` bei Erfolg
- Fehler (RFC 7807 / Problem+JSON):
  - `TOKEN_EXPIRED` (Ablauf),
  - `TOKEN_REUSE` / „invalid or already used“ (Einmaligkeit).

> Hinweis: Fehlercodes werden bewusst harmonisiert und folgen den bestehenden Token-Fehlern des Systems.

## Sicherheit & Compliance

- Admin-Authentisierung für das Erstellen von Links
- Token-Einmaligkeit über `used_at` + Hash-basiertes Lookup
- Ablaufprüfung via `expires_at`
- Fehlerformat: RFC 7807 / Problem+JSON
- Logs ohne PII (nur `tenant_id`, `device_id`; **kein** Token/Hash)

## Tests & Nachweise

### HTTP-Integration
- `apps/api/src/device-onboarding.http.spec.ts`  
  (Happy Path + Token-Reuse)

### Security / Idempotency / Rate Limits
- Idempotency: `apps/api/src/mw/idempotency.ts` + Tests (`mw/__tests__/`)
- Rate Limits: `apps/api/src/mw/rate-limit.ts` + Tests (`mw/__tests__/`)
- Security-Checks:
  - `npm run test:security:anti-replay`
  - `npm run test:security:device-proof`

### Build / Contract
- Lint/Build/Tests über CI (siehe `docs/CI-Gates.md`)
- OpenAPI Contract-Check: `npm run contract:check`

## Migration (Expand-Only)

- `0002_step18_device_registration_links.sql` ist **expand-only**
- keine Drops, keine Umbenennungen, keine Breaking Changes für bestehende Flows

---

## DSR- und Tombstone-Integration für `device_registration_links`

### Datenmodell & Personenbezug

- `device_registration_links` speichert nur indirekte Personenbezüge:
  - `tenant_id` (Mandant),
  - `device_id` (Gerät – potentiell einem Endnutzer zuordenbar),
  - `created_by_admin_id` (Admin, der den Link erstellt hat),
  - `token_hash` (Hash, kein Klartext-Token).
- Klartext-Tokens werden **nicht** persistiert.

### Retention & Aufräumlogik

- `expires_at` fungiert als fachliche TTL.
- Abgelaufene Einträge können — nach definierter Frist — gelöscht oder anonymisiert werden.
- Mögliche Anonymisierung (Policy-Ebene, kein Pflichtbestandteil in Step 18):
  - `token_hash` entfernen/neutralisieren,
  - `created_by_admin_id` auf `NULL` setzen,
  - `device_id` auf `NULL` setzen, sobald Onboarding abgeschlossen ist oder das Device gelöscht wird.

### Verhalten bei DSR für Admins

- `created_by_admin_id` ist mit `ON DELETE SET NULL` modelliert.
- Bei DSR (Löschung/Deaktivierung eines Admins):
  - verbleibende Einträge bleiben fachlich nutzbar,
  - der direkte Personenbezug entfällt (`created_by_admin_id = NULL`).

### Verhalten bei DSR für Endnutzer/Devices

- `device_id` kann einem Endnutzer zuordenbar sein.
- Bei DSR für Device/Endnutzer sollte:
  - `device_id` in `device_registration_links` auf `NULL` gesetzt  
    oder durch eine Tombstone-ID ersetzt werden,
  - verhindert werden, dass `tenant_id + device_id` eine Re-Identifikation ermöglicht.
- Umsetzung erfolgt zentral in der DSR-/Tombstone-Policy  
  (Step 18 erweitert nur das Datenmodell).

### Audit- und Logging-Aspekte

- Logs enthalten ausschließlich indirekte IDs (z. B. `tenant_id`, `device_id`).
- Bei DSR muss:
  - `device_id` in Logs/Audits entfernt oder pseudonymisiert werden,
  - WORM-Audits technisch bestehen bleiben,
  - die Re-Identifizierbarkeit jedoch ausgeschlossen sein.
- Step 18 führt **keine neuen Logfelder** ein und nutzt vorhandene Mechanismen.

> Die konkrete Umsetzung von Lösch-/Pseudonymisierungsprozessen für  
> `device_registration_links` erfolgt in der zentralen DSR-/Tombstone-Policy  
> und ist **nicht Bestandteil von Step 18**.

## Manueller Smoke-Test – Geräte-Onboarding (Dev)

Voraussetzungen:
- API läuft lokal (`npm --workspace apps/api run build && npm --workspace apps/api run start`).
- Korrekte Base-URL ohne `/v2`-Prefix, z. B.: `http://localhost:3000` (abhängig von `index.ts`-Routing).
- Admin-Token (falls Auth-Middleware auf den Endpunkten aktiv ist).

### 1. Registration-Link anlegen

```powershell
$base = "http://localhost:3000"    # ohne /v2
$admintoken = "<DEIN_ADMIN_JWT>"   # nicht einchecken

$idem = "manual-step18-$(Get-Random)"

curl.exe -i -w "`nSTATUS=%{http_code}`n" -X POST "$base/devices/registration-links" `
  -H "Authorization: Bearer $admintoken" `
  -H "Idempotency-Key: $idem" `
  -H "Content-Type: application/json"
