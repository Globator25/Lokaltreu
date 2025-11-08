# Lokaltreu AGENTS.md — v2.2-gold

## 0) Metadaten

Owner: Tech Lead  
Geltung: Verbindlich für menschliche Beiträge und KI-Aktionen  
Letzte Prüfung: <TT.MM.JJJJ>

## 1) Referenzen

SPEC v2.0, ARCH, ROADMAP 2.2, OpenAPI 3.1 (SSOT)

## 2) Projektfakten

[SENTINEL] SECTION: Projektfakten
Architektur: Modularer Monolith (TypeScript), Next.js PWA, Node.js API  
Standards: OpenAPI 3.1, RFC 7807, Idempotency-Key  
Security: Ed25519 Device-Proof, Anti-Replay, WORM-Audit, Retention 180 Tage  
Environments: dev, stage, prod (EU-Region)

## 3) KPI-Ziele (MUSS)

- schema_drift = 0
- coverage ≥ 80 %
- replay_blocks = 100 %
- proof_failures_caught = 100 %
- audit_gaps = 0

## 4) CI-Gates (MUSS) + KPIs

- Coverage: lines, functions, branches, statements ≥ 80 %
- Contract: OpenAPI-Validierung grün; schema_drift = 0
- Fehlerformat: error_conformity = 100 % (RFC 7807)
- Anti-Replay: Paralleltest grün; replay_blocks = 100 %
- Device-Proof: Positiv/Negativ-Fälle grün
- Plan-Gates: Starter → 403 PLAN_NOT_ALLOWED getestet
- OpenAPI-Lint: pass
- Terraform: fmt + validate grün (EU-Region erzwungen)
- GDPR: Checks grün (Art. 11, Retention 180 Tage)
- Merge-Block: required checks aktiv
  [SENTINEL] SECTION: CI-Gates (MUSS)

## 5) Workflow-Trennung und Zweck

- ci.yml: Kernqualität (Lint, Codegen, Build, Tests, Contract, Coverage)
- gdpr-compliance.yml: Art. 11, Retention, Log-PII-Checks, Terraform EU-Only
- security-gates.yml: Device-Proof, Anti-Replay, Rate-Limits
  Begründung: rechtlich und sicherheitsrelevante Prüfungen getrennt skalieren und reviewen.

## 6) Aufgabenrezepte (CLI/IDE)

[SENTINEL] SECTION: Aufgabenrezepte

1. OpenAPI → Types
   codex exec "Generiere @lokaltreu/types aus OpenAPI und fixe Imports" --role Contract-Sheriff --context @apps/api/openapi/lokaltreu-openapi-v2.0.yaml @packages/types/\*\*
2. RFC7807-Fehlerkonsistenz
   codex exec "Validiere RFC7807-Fehler und ergänze fehlende error_code Enums" --role ProblemJSON-Arbiter --context @apps/api/openapi/** @apps/api/src/**
3. Parallel-Anti-Replay
   codex exec "Erstelle Anti-Replay-Test (10 parallel) für Idempotency-Key" --role Idempotency-Guardian,Test-Pilot --context @apps/api/src/mw/idempotency.ts @tests/security/\*\*
4. Plan-Gate
   codex exec "Schreibe Tests: Starter→403 PLAN_NOT_ALLOWED; Plus/Premium→OK" --role ProblemJSON-Arbiter,Test-Pilot --context @apps/api/src/handlers/referrals.ts @apps/api/openapi/\*\*
5. Device-Proof
   codex exec "Schreibe Positiv/Negativ-Fälle für X-Device-Proof (Ed25519)" --role Device-Proof-Engineer --context @apps/api/src/middleware/device-auth.ts

## 7) Security & DSGVO Leitplanken

- Keine PII in Logs; erlaubt: tenant_id, device_id, card_id
- Secrets nur via SOPS (\*.enc.tfvars)
- EU-Region erzwingen
- Art. 11 DSR ohne Zusatzidentifizierung
- Retention 180 Tage; WORM-Audit; signierte Exporte (R2)

## 8) Zentrale PR-Checkliste

[SENTINEL] SECTION: ZENTRALE PR-CHECKLISTE

- Lint grün
- Build grün
- Tests grün + Coverage ≥ 80 %
- Contract-Tests grün, schema_drift = 0
- Fehler 100 % RFC 7807 konform
- Parallel-Anti-Replay grün (1×201, 9×409)
- Device-Proof-Fälle grün
- Plan-Gate-Cases grün (Starter → 403 PLAN_NOT_ALLOWED)
- OpenAPI-Lint pass
- Terraform fmt + validate grün (EU-Only)
- GDPR-Checks grün (Art. 11, Retention 180 Tage)
- Audit-Artefakte erzeugt

## 9) Audit-Trail

[SENTINEL] SECTION: Audit-Trail

- Jeden "codex exec"-Run per tee als Artefakt ablegen: ... | tee -a artifacts/codex-$(date +%Y%m%d-%H%M%S).log

## 10) Pflege & Versionierung

- Änderungen an AGENTS.md nur via PR; Reviewer: Owner + betroffene Rolle
- Quartalsreview: Rollen, KPIs, Gates
- Changelog-Eintrag in docs/CHANGELOG.md unter "Governance"
