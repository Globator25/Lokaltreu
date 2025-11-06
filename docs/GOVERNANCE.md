# Governance

## Branch-Protection auf `main`
- Branchschutz aktiv mit „Require linear history/Rebase required“.
- `gdpr-compliance` ist als Required-Check hinterlegt.
- Mindestens ein Review ist für jeden Merge Pflicht.

## Gates und Zuständigkeiten
| Gate            | Zuständigkeit               |
| --------------- | --------------------------- |
| Lint            | Engineering (CI Maintainer) |
| Build           | Platform Team               |
| Tests/Coverage  | QA & Engineering            |
| Contract        | Contract-Sheriff            |
| gdpr-compliance | Compliance Officer (GDPR)   |
