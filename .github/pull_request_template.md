# Pull Request Checklist (ZENTRALE PR-CHECKLISTE)

Bitte vor Merge sicherstellen:

- [ ] **CI Checks** (`ci`, `security-gates`, `gdpr-compliance`) sind alle grün.
- [ ] **Coverage ≥ 80 %** für API und Web erreicht.
- [ ] **schema_drift = 0** (SSOT stabil).
- [ ] **OpenAPI** lint + contract tests (RFC 7807) erfolgreich.
- [ ] **Anti-Replay & Device-Proof** Tests bestanden.
- [ ] **GDPR Checks** (Art. 11, Retention 180 T, keine PII, EU-only Terraform) bestanden.
- [ ] **Branch** ist aktuell (no stale merges).
- [ ] **2 Reviewer-Approvals**, inkl. mindestens 1 Maintainer / Owner.
- [ ] Änderungen an Governance oder Workflows wurden von **CODEOWNERS** freigegeben.
- [ ] `docs/CHANGELOG.md` bei Governance-/CI-Änderungen aktualisiert.

Referenz: [docs/AGENTS.md](../docs/AGENTS.md)
