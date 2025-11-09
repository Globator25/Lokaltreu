# Contributing

## PR-Ablauf
1. Branch erstellen, konventionelle Commits verwenden (feat, fix, chore, docs, test).
2. PR öffnen und **ZENTRALE PR-CHECKLISTE** aus [docs/AGENTS.md](docs/AGENTS.md) abarbeiten.
3. Warten bis alle **Required Checks** grün sind: `ci`, `security-gates`, `gdpr-compliance`.
4. Mindestens 2 Reviews; betroffene CODEOWNERS müssen zustimmen.

## Required Checks
- **ci:** Lint, Build, Tests (api/web), Coverage ≥ 80 %, OpenAPI-Codegen, Spectral-Lint, schema_drift=0, Contract-Tests, optional Terraform validate.
- **security-gates:** Anti-Replay, Device-Proof.
- **gdpr-compliance:** Dokumente vorhanden, Retention 180 Tage, keine PII in Logs, EU-only Terraform.

## Lokale Tests
```bash
# Lint/Build
npm run lint && npm run build

# API/Web Tests mit Coverage
npm run -w apps/api test -- --coverage --run
npm run -w apps/web test -- --coverage --run

# Contract-Tests gegen Prism-Mock
npx prism mock apps/api/openapi/lokaltreu-openapi-v2.0.yaml -p 4010 &
npm run test:contract

# OpenAPI-Lint
npx @stoplight/spectral-cli lint apps/api/openapi/lokaltreu-openapi-v2.0.yaml

# schema_drift Gate
npm run -w packages/types test:schema-drift

# Security-Gates
npm run test:security:anti-replay
npm run test:security:device-proof

# GDPR Checks
node scripts/check-docs-present.mjs compliance
node scripts/check-retention.mjs 180
npm run scan:logs:no-pii
node scripts/terraform-enforce-eu.mjs infra/terraform
````

## Commit-Konvention

* Format: `type(scope): subject`
* Beispiele: `feat(api): add referral plan gate`, `test(web): increase coverage in auth guard`
