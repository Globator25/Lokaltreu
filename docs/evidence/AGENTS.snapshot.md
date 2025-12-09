# AGENTS – Governance Snapshot

Dieses Evidence-Dokument hält den aktuellen Stand von `AGENTS.md` fest (Version 2.2-gold) inklusive Sentinel-Hinweise. Es dient Auditoren und Maintainer:innen als Referenz, um sicherzustellen, dass CI-Gates und Rollenmodelle jederzeit nachvollziehbar bleiben.

---

## 0. Kontext

- Sentinel aktiv (CI validiert Pflichtabschnitte).  
- Arbeitssprache: Deutsch für Governance, Englisch für Code/API/Errors.  
- Referenzen: SPEC v2.0, lokaltreu-roadmap 2.3.1, lokaltreu-agents-goldstandard.

---

## 1. Produktleitplanken (Kurzfassung)

1. Single-Admin-Design  
2. Radikale Einfachheit (Mitarbeiter: 2 Aktionen)  
3. Privacy by Design (Endkunden anonym)  
4. Security by Default (Anti-Replay, Device-Proof, Plan-Limits)  
5. PWA-first  
6. EU-Hosting & DSGVO

---

## 2. Rollen im Editor

- **Technischer Product Owner** – prüft Scope vs. Roadmap/OpenAPI/MVP.  
- **Software-Architekt** – schützt Anti-Replay, Device-Proof, WORM-Audit, Plan-Limits.  
- Weitere Rollen gemäß Goldstandard (Contract-Sheriff, ProblemJSON-Arbiter, Idempotency-Guardian, Device-Proof-Engineer, Audit-Officer, Test-Pilot, Docs-Keeper).

---

## 3. Nutzung im Editor

1. `AGENTS.md` lesen und befolgen.  
2. Bei fachlichen/architekturellen Fragen immer SPEC, Roadmap, Goldstandard heranziehen.  
3. Keine Features, die PII sammeln, Single-Admin aufbrechen oder PWA-first verletzen.

---

## 4. CI-Gates & Quality

- Muss-Gates: Lint, Build, Tests, Coverage ≥ 80 %, schema_drift = 0, GDPR, Security, Terraform EU-only.  
- Änderungen an Gates müssen in `docs/CI-Gates.md` dokumentiert werden.

---

## 5. Emergency Break-Glass Deployment

- Gründe: nur kritische Security-Lücke oder massiver Incident (SLO-Bruch).  
- Rollen: Tech Lead + Audit-Officer/Contract-Sheriff → 2-Faktor-Freigabe, Protokoll im Incident-Log.  
- Ablauf: PR `[BREAK-GLASS]` → zwei Maintainer-Reviews → Admin-Merge → Entscheidung + Zeitstempel loggen → Follow-up-Ticket.  
- Gates nachziehen, bevor weitere Break-Glass-Aktionen möglich sind.

---

## 6. Sentinel Sections (Validierung)

- Projektfakten  
- CI-Gates (MUSS)  
- Aufgabenrezepte  
- Audit-Trail  
- Zentrale PR-Checkliste

Diese Snapshot-Datei wird aktualisiert, sobald `AGENTS.md` geändert oder neu versioniert wird. Sie unterstützt Audits und CI-Checks, indem sie den dokumentierten Governance-Zustand einfriert.
