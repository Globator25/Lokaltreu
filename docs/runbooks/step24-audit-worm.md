# Runbook – Step 24 Audit WORM (Local)

Ziel: Audit‑WORM lokal testen (write‑once → export → verify → gap‑check → retention).  
Hinweis: Keine Secrets ins Repo. Keys und ENV nur lokal/CI.

## Voraussetzungen

- Lokale DB erreichbar: `DATABASE_URL` (Postgres)
- Optional: MinIO/S3 (für Export)
- Public/Private Key lokal verfügbar (Ed25519)

## Pflicht‑ENV (Export)

**DB**
- `DATABASE_URL`

**Export (S3/MinIO)**
- `AUDIT_EXPORT_S3_BUCKET`
- `AUDIT_EXPORT_S3_REGION`
- `AUDIT_EXPORT_S3_ACCESS_KEY_ID`
- `AUDIT_EXPORT_S3_SECRET_ACCESS_KEY`
- `AUDIT_EXPORT_KEY_ID`
- `AUDIT_EXPORT_PRIVATE_KEY` (PEM‑Text oder Base64‑PEM)

**Optional**
- `AUDIT_EXPORT_S3_ENDPOINT` (z. B. MinIO URL)
- `AUDIT_EXPORT_S3_PATH_STYLE` (`true` für MinIO)
- `AUDIT_EXPORT_PREFIX` (Default: `audit`)
- `AUDIT_EXPORT_SCHEMA_VERSION`
- `AUDIT_EXPORT_BATCH_SIZE`
- `AUDIT_EXPORT_TENANTS` (CSV)

## Verify‑ENV (alternativ zu CLI‑Args)

- `AUDIT_EXPORT_VERIFY_DIR` (Pfad mit `meta.json`, `meta.sig`, `events.ndjson`)
- `AUDIT_EXPORT_VERIFY_PUBLIC_KEY` (Public Key PEM)

## 1) Neue Events erzeugen (write‑once)

```bash
DATABASE_URL=postgres://... \
TENANT_ID=... \
npm -w apps/api run audit:worm:write-once
```

## 2) Export ausführen

```bash
DATABASE_URL=postgres://... \
AUDIT_EXPORT_S3_BUCKET=... \
AUDIT_EXPORT_S3_REGION=... \
AUDIT_EXPORT_S3_ACCESS_KEY_ID=... \
AUDIT_EXPORT_S3_SECRET_ACCESS_KEY=... \
AUDIT_EXPORT_KEY_ID=... \
AUDIT_EXPORT_PRIVATE_KEY="$(cat .secrets/audit_export_ed25519_private.pem)" \
npm -w apps/api run audit:export:worm
```

## 3) Export‑Artefakte herunterladen (MinIO Beispiel)

Falls MinIO + `mc` lokal vorhanden ist, kannst du die Artefakte so holen:

```bash
# Beispiel: mit dockerisiertem mc (mc_local)
docker run --rm --network container:lokaltreu-minio \
  -v ${PWD}:/work -w /work \
  minio/mc cp --recursive \
  lokaltreu/lokaltreu-audit/audit/tenant=.../date=.../from_..._to_... \
  tmp/audit-export-verify
```

Erwartete Dateien:
- `tmp/audit-export-verify/events.ndjson`
- `tmp/audit-export-verify/meta.json`
- `tmp/audit-export-verify/meta.sig`

## 4) Verify ausführen

```bash
npm -w apps/api run audit:export:verify
```

Exitcodes:
- `0` = OK
- `1` = Usage/Datei fehlt
- `2` = Verifikation fehlgeschlagen (Signatur/Integrity/Chain/Fingerprint)

## 5) Gap‑Monitor

```bash
DATABASE_URL=postgres://... \
AUDIT_EXPORT_GAP_MINUTES=15 \
AUDIT_EXPORT_TENANTS=... \
npm -w apps/api run audit:monitor:gap
```

Interpretation:
- Exit `0` = keine Gaps
- Exit `2` = Gap > Threshold (Alerting)

## 6) Retention‑Job

```bash
DATABASE_URL=postgres://... \
AUDIT_RETENTION_DAYS=180 \
npm -w apps/api run audit:retention:worm
```

Output: `audit retention pruned { deleted_count: ... }`

## 7) One‑Shot Flow (alles in Reihenfolge)

```bash
npm -w apps/api run audit:flow:local
```

Erwartet: write‑once → export → verify → gap‑check.
