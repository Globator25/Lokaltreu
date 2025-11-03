# Lokaltreu AGENTS.md — Gold-Standard (v2.2-gold)
Geltung: verbindlich für alle Beiträge. Priorität: SPEC → OpenAPI → ARCH → AGENTS.md → Code.
KPI-Gates: schema_drift=0, error_conformity=100%, coverage≥80%, GDPR grün, EU-Only Terraform.
[SENTINEL] SECTION: Projektfakten
- Single-Admin je Mandant (Referenz: docs/ADR/0001-no-multi-admin.md)
[SENTINEL] SECTION: CI-Gates (MUSS)
- DSGVO-Checks verpflichtend (Art. 6(1)(f) + Art. 11 umgesetzt, Logs personenbezogen)
- Retention 180 Tage für Audit- und Sicherheitslogs muss verifiziert sein
[SENTINEL] SECTION: Aufgabenrezepte
[SENTINEL] SECTION: Aufgabenrezepte — CLI Automationen
- `codex exec "Generiere @lokaltreu/types aus OpenAPI und fixe Imports" --role Contract-Sheriff --context @apps/api/openapi/lokaltreu-openapi-v2.0.yaml @packages/types/**`
- `codex exec "Implementiere POST /stamps/claim idempotent, Fehler RFC7807" --role Idempotency-Guardian,ProblemJSON-Arbiter,Audit-Officer --context @apps/api/openapi/** @apps/api/src/mw/** @apps/api/src/handlers/**`
- `codex exec "Schreibe Vitest Contract-Tests mit chai-openapi-response-validator" --role Contract-Sheriff,Test-Pilot --context @apps/api/openapi/** @tests/**`
- `codex exec "Erstelle Anti-Replay-Test für Idempotency-Key (10 parallel)" --role Idempotency-Guardian,Test-Pilot --context @apps/api/src/mw/idempotency.ts @tests/security/**`
- `codex exec "Füge Plan-Gate (403 PLAN_NOT_ALLOWED) inkl. Tests hinzu" --role ProblemJSON-Arbiter,Test-Pilot --context @apps/api/src/handlers/referrals.ts @apps/api/openapi/**`
- `codex exec "Implementiere Ed25519-Validierung für X-Device-Proof" --role Device-Proof-Engineer --context @apps/api/src/middleware/device-auth.ts`
- `codex exec "Aktualisiere JSDoc+README mit Beispielen" --role Docs-Keeper --context @apps/api/src/** @README.md`
[SENTINEL] SECTION: Audit-Trail
[SENTINEL] SECTION: ZENTRALE PR-CHECKLISTE
Rezepte siehe Abschnitt „Kommandos“.
