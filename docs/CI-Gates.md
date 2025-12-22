# CI-Gates & Qualitätsbarrieren – Lokaltreu

Dieses Dokument beschreibt alle verpflichtenden CI-Gates für das Lokaltreu-Repository. Es basiert auf [AGENTS §6–§7], [SPEC §19], [ROADMAP Schritte 4–5, 37–45], [lokaltreu-agents-goldstandard.md] sowie den Compliance-Artefakten (DPIA, RoPA, TOMs). Ein Merge in `main` ist nur zulässig, wenn sämtliche Gates grün sind oder ein dokumentierter Break-Glass-Flow (AGENTS §5) greift.

---

## 1. Build & Lint Layer

| Gate | Beschreibung | Tool/Job | DoD |
| --- | --- | --- | --- |
| Lint | ESLint/TS-Lint inkl. Format-Regeln | `npm run lint` / `ci.yml` | Keine Lint-Errors; Warnungen sind Blocker |
| Build | Alle Workspaces bauen erfolgreich | `npm run build --workspaces` | Kein TypeScript-Error, keine bundler warnings |
| Dependencies | Lockfile konsistent, keine ungeprüften Upgrades | `npm audit --production` (Info), Renovate-PRs | CR bestätigt Security-Fixes |

---

## 2. Tests & Coverage

- **Unit/Integration:** `npm test --workspaces -- --coverage`.  
- **Coverage-Schranken (MUSS):** lines ≥ 80 %, functions ≥ 80 %, branches ≥ 80 %, statements ≥ 80 %.  
- **Contract-Tests:** Frontend vs. OpenAPI (`contract-sync-frontend` Job). Build schlägt rot bei Schema-Divergenz (schema_drift = 0).  
- **Parallel-/Anti-Replay-Tests:** Spezielle Suite (Idempotency-Guardian) mit 10 parallelen Requests → 1×201, 9×409.  
- **Device-Proof-Tests:** Positiv-/Negativ-Cases für Ed25519-Header auf allen geschützten Routen.  
_Quelle: [AGENTS §6], [ROADMAP Schritt 37–38]_

---

## 3. Security & Abuse Gates

| Gate | Scope | Prüfung |
| --- | --- | --- |
| Problem+JSON | Fehlerformat 100 % RFC 7807 konform, Error-Codes laut SPEC | automatischer validator (`tests/problem-json.spec.ts`) |
| Anti-Replay | Redis `SETNX`-Simulation inkl. TTL | parallel test suite |
| Device-Proof | Header Validierung, Zeitfenster, Signatur | `tests/device-proof.spec.ts` |
| Plan/Referral-Gates | Starter → 403 PLAN_NOT_ALLOWED; Plus/Premium → OK; Downgrade deaktiviert | `tests/plan-gate.spec.ts` |
| Rate-Limits | Limits tenant/ip/card/device/referral | Integration-Tests + config snapshot |

Alle Security-Gates laufen im Workflow `security-gates.yml`. Ergebnisse werden an Audit-Officer gespiegelt (artifacts).  
_Quelle: [SPEC §7], [ROADMAP Schritte 25–26, 42]_

---

## 4. Compliance & DSGVO Gates

- **gdpr-compliance.yml:** Prüft Existenz/Aktualität von AVV, TOMs, RoPA, DPIA, Retention-Policy, Infos-DE.  
- **Retention Enforcement:** verifiziert 180-Tage-Regel in Code (cron/jobs) und `deleted_subjects`-Tombstone-Skript.  
- **DSR-Flow:** E2E-Test stellt sicher, dass Art.-11-Prozess funktional ist und Audit-Logs erzeugt.  
- **EU-Only Proof:** Terraform/infra-Konfig zwingt EU-Regionen; CI validiert `region` Attribute.  
_Quelle: [ROADMAP Schritte 2, 34, 48], [AGENTS §9]_

---

## 5. Infrastructure & Terraform

- **terraform fmt** und **terraform validate** auf allen Workspaces.  
- **schema_drift = 0:** Datenbank-Migrationen werden mit Expand-Contract-Checklisten begleitet; automatischer Drift-Check blockiert Merge bei Abweichung.  
- **Secrets:** SOPS/`*.enc.tfvars` must exist; Gate prüft, dass keine Klartext-Secrets committed sind (`scripts/secret-scan`).  
_Quelle: [ROADMAP Schritte 6, 13], [AGENTS §6]_

---

## 6. Observability & FinOps Gates

- **OTel Coverage:** Build prüft, dass zentrale Routen Tracing + Metrik-Instrumentierung registrieren (lint rule `otel-required`).  
- **Dashboard Snapshots:** Stage-Dashboards (p50/p95/p99, Fehlscan-Spikes, cost_per_tenant) werden wöchentlich exportiert; CI verifiziert Aktualität (<7 Tage).  
- **cost_per_tenant Alert:** FinOps-Check (scripts/validate-cost-metrics.ts) vergleicht aktuelle Messung mit Threshold; Anstieg >15 % erfordert manuellen Ack.  
_Quelle: [SPEC §19], [ROADMAP Schritte 8, 47–48]_

---

## 7. Break-Glass Policy

- Break-Glass ist nur zulässig bei kritischen Security-Lücken oder Incident (AGENTS §5).  
- PR muss `[BREAK-GLASS]` im Titel tragen, zwei Maintainer-Approvals besitzen, Audit-Log + Ticket verlinken.  
- Nach Merge: Alle übersprungenen Gates werden unverzüglich nachgezogen, Ticket dokumentiert die Nacharbeit. Weitere Break-Glass-Versuche sind bis Abschluss gesperrt.  
_Quelle: [AGENTS §5], [ROADMAP Schritt 42]_

---

## 8. Review-Checklist

Jeder PR verweist auf diese Punkte (siehe AGENTS §11):
1. Lint/Build/Test/Contract grün.  
2. Coverage ≥ 80 %, schema_drift = 0.  
3. Problem+JSON und Device-Proof geprüft.  
4. Plan-/Referral-Gates nachgewiesen.  
5. Terraform + GDPR + Security-Workflows grün.  
6. Audit-Artefakte und Observability-Snapshots aktualisiert.  
7. Falls Break-Glass: Ticket/Log-Link vorhanden.

---

## 9. Verantwortlichkeiten

- **Tech Lead:** Owner aller CI-Gates, Break-Glass-Freigabe.  
- **Contract-Sheriff:** schema_drift, OpenAPI, Contract-Sync.  
- **Test-Pilot:** Tests, Coverage, Parallel/Device-Proof Suites.  
- **Audit-Officer:** GDPR, Security-Gates, Artefakte.  
- **Infra-Engineer:** Terraform, EU-Only-Proofs, Observability.  

Änderungen an diesem Dokument erfordern Review durch Tech Lead + betroffene Rollen. Jede Revision wird im Governance-Changelog dokumentiert.
