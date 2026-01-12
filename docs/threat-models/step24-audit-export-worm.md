# Threat Model (STRIDE) – Step 24 Audit‑WORM Export

**Scope:** `apps/api` – WORM audit log, retention job (180 days), export job (≤ 15 min snapshots), local verification CLI.  
**Non‑goals:** This document does not assume or assert infrastructure/IAM specifics unless verifiable via repo artifacts.

## Assets

- **DB tables**
  - `audit_log_worm` (append-only audit events)
  - `audit_export_runs` (export run history, ranges, status)
  - `audit_chain_state` (if present in DB; only in scope if used)
- **Keys**
  - Ed25519 private signing key (export job input; must not be stored in repo)
  - Ed25519 public key(s) (verifier input)
  - Key metadata: `key_id`, `public_key_fingerprint_sha256`
- **Object storage**
  - bucket + prefix containing export artifacts
  - `events.ndjson`, `meta.json`, `meta.sig`
- **Manifests**
  - `meta.json` (integrity/chain + key id/fingerprint)
  - `meta.sig` (base64 text; raw 64-byte Ed25519 signature over `meta.json` bytes)

## Data flows (high level)

1) Application writes audit events to `audit_log_worm`.  
2) Export job reads a tenant range from `audit_log_worm`, writes:
   - `events.ndjson` (NDJSON events)
   - `meta.json` (manifest: hashes, counts, range, chain anchors, signature metadata)
   - `meta.sig` (base64 signature over exact `meta.json` bytes)  
   and updates `audit_export_runs`.  
3) Gap monitor detects export gaps and alerts via exit code / webhook (best-effort).  
4) Verify CLI checks signature, fingerprint, NDJSON integrity, and hash-chain.

## STRIDE threats → controls → evidence

### S — Spoofing (identity)

- **Threat:** An attacker writes objects to the export prefix pretending to be the exporter.
  - **Controls**
    - Ed25519 signature verification over byte-exact `meta.json`
    - Public key selection by `key_id` + fingerprint check
    - Least-privilege credentials (DB + object storage) (infrastructure concern)
  - **Evidence (repo)**
    - Verifier enforces signature validation and fingerprint validation:
      - `apps/api/src/jobs/audit-export-verify.ts`
      - `apps/api/tests/audit/audit-export-verify.spec.ts`
  - **Evidence (operational / infra)**
    - Object storage policy restricting writes to the expected prefix
    - Separate DB role for export jobs with minimal grants

### T — Tampering (data integrity)

- **Threat:** Modify `meta.json` (range/key ids/hashes/tenant).
  - **Controls**
    - `meta.sig` signs the exact UTF-8 bytes written to `meta.json`
  - **Evidence**
    - Test: “meta modified → signature invalid”
      - `apps/api/tests/audit/audit-export-verify.spec.ts`

- **Threat:** Modify `meta.sig` (invalid base64, wrong length, altered bytes).
  - **Controls**
    - Verifier requires base64-decode length == 64 and Ed25519 verify == true
  - **Evidence**
    - Verifier implementation:
      - `apps/api/src/jobs/audit-export-verify.ts`

- **Threat:** Modify `events.ndjson` (bytes, removed/added lines, reordered).
  - **Controls**
    - `meta.json.artifacts.events` includes `sha256`, `bytes`, `lines` and verifier checks exact match
    - Hash-chain validation: each `prev_hash` must equal previous `hash`
  - **Evidence**
    - Tests: 1-byte modification / reorder / chain break → verify fails
      - `apps/api/tests/audit/audit-export-verify.spec.ts`

- **Threat:** Modify DB audit events (UPDATE/DELETE) to rewrite history.
  - **Controls**
    - DB-level append-only protection for WORM table (trigger/constraint)
  - **Evidence (operational / DB)**
    - `psql` proof: `UPDATE audit_log_worm ...` is rejected
    - Schema/trigger introspection: `\d+ audit_log_worm`
  - **Evidence (repo)**
    - WORM writer unit tests (hashing/chain behavior):
      - `apps/api/src/modules/audit/worm/worm-writer.spec.ts`

### R — Repudiation (non-repudiation / auditability)

- **Threat:** Exporter denies that a given export was produced.
  - **Controls**
    - Signed `meta.json` with `key_id` + fingerprint and chain anchors
    - `audit_export_runs` records success/failure for each range
  - **Evidence**
    - Export job produces `meta.json/meta.sig` and stores run:
      - `apps/api/src/modules/audit/export/audit-export.job.ts`
      - `apps/api/tests/audit/audit-export-job.spec.ts`
    - Operational DB query:
      - `SELECT tenant_id, from_seq, to_seq, status, created_at FROM audit_export_runs ...`

### I — Information disclosure (confidentiality)

- **Threat:** Tenant data bleed (wrong tenant_id exported into wrong prefix / wrong selection).
  - **Controls**
    - Tenant is explicit in `meta.json.tenant_id` and prefix conventions (`tenant=...`)
    - Export queries must filter by `tenant_id` (implementation concern)
    - Least-privilege prefix scoping per tenant (infrastructure concern)
  - **Evidence (repo)**
    - Export prefix includes tenant:
      - `apps/api/src/modules/audit/export/audit-export.job.ts`
      - `apps/api/tests/audit/audit-export-job.spec.ts`
  - **Evidence (needs additional operational proof)**
    - Bucket policy or separate per-tenant prefixes/credentials
    - Spot-check exports against DB ranges per tenant

- **Threat:** PII leakage in logs or artifacts.
  - **Controls**
    - Logging guidance: no PII; allowed pseudonyms only (tenant_id/device_id/card_id)
    - Error messages sanitized/length-limited for export-run DB storage
  - **Evidence (repo)**
    - Sanitized error message truncation in export job:
      - `apps/api/src/modules/audit/export/audit-export.job.ts`
  - **Evidence (process)**
    - Review checklist / GDPR CI gate (if present in CI, outside this doc’s scope)

### D — Denial of service (availability)

- **Threat:** Export gaps > threshold (e.g., scheduler down, S3 down, DB down).
  - **Controls**
    - Gap monitor job with threshold; non-zero exit code for alerting
    - Optional webhook alert (best-effort)
  - **Evidence**
    - Gap monitor tests + job:
      - `apps/api/tests/audit/audit-export-monitor.spec.ts`
      - `apps/api/src/jobs/audit-export-gap-check.ts`

- **Threat:** Partial upload (events written but meta/sig missing), or inconsistency between S3 objects and DB run status.
  - **Controls**
    - Job writes `events.ndjson`, then `meta.json`, then `meta.sig`, then marks run success
    - Verifier fails if artifacts missing (operational usage)
  - **Evidence**
    - Export job ordering:
      - `apps/api/src/modules/audit/export/audit-export.job.ts`
    - Operational check: object listing under `object_key_prefix`

### E — Elevation of privilege

- **Threat:** Export job runtime can read/write broader DB or object storage than required.
  - **Controls**
    - Separate DB role grants and separate object storage credentials, least-privilege
  - **Evidence (infra)**
    - DB grants / IAM policies (not provable from repo without IaC artifacts)

## Key compromise / rotation

- **Threat:** Signing private key compromise → forged exports that verify.
  - **Controls**
    - Rotation via `key_id` and updating verifier’s public key mapping
    - Fingerprint checks bind `key_id` to the expected public key material
    - Operational revocation strategy (key registry status/denylist)
  - **Evidence**
    - `meta.json.signature.key_id` and fingerprint fields + verifier behavior:
      - `apps/api/src/jobs/audit-export-verify.ts`
      - `apps/api/src/modules/audit/export/audit-export.job.ts`

## Evidence checklist (copy/paste for audits)

- Lint/build/tests (repo): `npm -w apps/api run lint && npm -w apps/api run build && npm -w apps/api test`
- Export artifacts existence (runtime): list prefix and confirm `events.ndjson`, `meta.json`, `meta.sig`
- Verify (runtime): `npm -w apps/api run audit:export:verify` (or `--dir/--pub`) and capture JSON output + exit code
- DB proof (runtime): show `audit_export_runs` row for the range and `audit_log_worm` max seq for tenant
- Gap monitor (runtime): run with `AUDIT_EXPORT_GAP_MINUTES=15`, capture exit code
- Retention (runtime): run retention job and capture before/after counts for `ts < now() - interval '180 days'`

