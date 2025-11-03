# Lokaltreu Pull Request

## ZENTRALE PR-CHECKLISTE
- [ ] SPEC-Quelle geprüft (`SPEC.md`, SSOT `apps/api/openapi/lokaltreu-openapi-v2.0.yaml` aktuell)
- [ ] Architektur-Auswirkungen bewertet (`ARCH.md`, Terraform EU-only)
- [ ] Lint grün
- [ ] Build grün
- [ ] Tests grün + Coverage ≥ 80 %
- [ ] Contract-Tests grün, schema_drift = 0
- [ ] Fehler 100 % RFC 7807
- [ ] Parallel-Anti-Replay grün (1×201, 9×409)
- [ ] Device-Proof-Fälle grün
- [ ] Plan-Gate Starter → 403 PLAN_NOT_ALLOWED
- [ ] OpenAPI-Lint pass
- [ ] Terraform fmt + validate (EU-only)
- [ ] GDPR-Checks grün (Art. 11, Retention 180 Tage)
- [ ] Audit-Artefakte vorhanden

Begründung: ZENTRALE PR-CHECKLISTE laut AGENTS.md.
