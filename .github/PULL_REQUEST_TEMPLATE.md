# Checkliste (AGENTS.md)

- [ ] Lint grün
- [ ] Build grün
- [ ] Tests grün
- [ ] Coverage ≥ 80 % nachgewiesen
- [ ] Contract-Pass (schema_drift = 0)
- [ ] Fehler 100 % RFC 7807
- [ ] Parallel-Anti-Replay grün (1×201, 9×409)
- [ ] Device-Proof-Fälle grün
- [ ] Plan-Gate-Cases grün (Starter → 403 PLAN_NOT_ALLOWED)
- [ ] OpenAPI-Lint pass
- [ ] Terraform fmt + validate grün (EU-Only)
- [ ] **gdpr-compliance** grün (Art. 11, Retention 180 Tage)
- [ ] Audit-Artefakte (Logs, Diffs, Reports) verlinkt
- [ ] Link zur letzten CI-Run-Summary beigefügt

## Risk Assessment

- Blast radius: <!-- describe components/users impacted -->
- Rollback ready? <!-- yes/no -->

## Links

- ADR IDs: <!-- e.g. ADR-0004 -->
- Runbooks: <!-- incident/rollback -->
- Observability Dashboard: <!-- URL -->

## Governance

- [ ] CODEOWNERS sensitive area reviewed (falls zutreffend)
