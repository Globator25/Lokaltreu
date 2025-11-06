# AGENTS.md — Gold v2.2

status: authoritative  
ci-required: true

required-checks:

- ci / build
- ci / openapi-lint-and-codegen
- ci / unit-and-contract
- ci / coverage (>=80%)
- gdpr-compliance / gdpr-checks
- security-gates / anti-replay
- security-gates / device-proof
- security-gates / rfc7807-and-plan-gates
- security-gates / terraform-validate-eu-only
- security-gates / secrets-scan

policy:

- retention_days: 180
- x-schema-drift-policy: "0"

Priorität: `SPEC → OpenAPI → ARCH → AGENTS.md → Code`.

---

## Rollen & RACI

| Change-Typ        | Responsible  | Accountable | Consulted    | Informed     |
| ----------------- | ------------ | ----------- | ------------ | ------------ |
| Code              | Backend-Core | Maintainer  | PlatOps      | Sec-Leads    |
| Prompts/Policies  | Sec-Leads    | Maintainer  | Backend-Core | PlatOps      |
| Secrets           | PlatOps      | Sec-Leads   | Maintainer   | Backend-Core |
| Workflows (CI/CD) | PlatOps      | Maintainer  | Sec-Leads    | Backend-Core |

## Entscheidungsrechte

- **Maintainer:** can ship ✓ · can block ✓ · can revert ✓
- **Sec-Leads:** can ship ✗ · can block ✓ (Security) · can revert ✓
- **PlatOps:** can ship (infra) ✓ · can block ✗ · can revert ✓ (runtime)
- **Backend-Core:** can ship ✓ · can block ✓ (code quality) · can revert ✓

## Change-Pfad

1. RFC/ADR dokumentieren (`docs/adr/`).
2. CODEOWNERS-Review (Security + Maintainer + betroffene Teams).
3. Merge-Strategie: Squash-Merge, `main` linear, keine Force-Pushes.
4. Rollback gemäß `docs/runbooks/rollback.md`.

## Notfallpfad

- Break-glass nur via 2FA-Hardware.
- Max. 2 Maintainer besitzen Break-glass-Tokens.
- Pflicht-Post-Mortem innerhalb 24 h (`docs/runbooks/incident.md`).
- Nach-Deploy RFC/ADR ergänzen.

## SLOs

- Code-Review ≤ 24 h (Business).
- Security-Fix-Review ≤ 4 h (On-Call).
- Revert bei Incident ≤ 1 h (Business).
- On-Call: Maintainer & Sec-Leads rotierend (Kalender im Team-Drive).
- Workflow-Fixes (CI) ≤ 8 h.

## Audit-Anker

- `docs/ADR/`
- `docs/runbooks/incident.md`
- `docs/runbooks/rollback.md`
- `observability/README.md`
- `SECURITY.md`

## Verbote für Agents

- Keine Produktions-Terraform-Ausführung.
- Keine Secrets auslesen/rotieren.
- Keine Änderungen an `.sops.yaml`.
- Keine Key-Rotation, keine Break-glass-Aktivierung.
- Keine manuellen Deploys oder Änderungen außerhalb der definierten Workflows.
  Test line
