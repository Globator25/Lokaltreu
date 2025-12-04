# CI-Gates

| Gate                      | Zweck                           | Wie lokal reproduzieren                       | Artefakt/Report                        |
| ------------------------- | ------------------------------- | --------------------------------------------- | -------------------------------------- |
| Lint/Build                | Codequalität & Build            | `npm run lint && npm run build`               | N/A                                    |
| Tests api/web             | Unit/Int Tests, Coverage ≥ 80 % | siehe CONTRIBUTING.md                         | `apps/*/coverage/`                     |
| OpenAPI Codegen           | SSOT Types                      | `npx openapi-typescript apps/api/openapi/lokaltreu-openapi-v2.0.yaml -o packages/types/src/index.d.ts` | `packages/types/src/index.d.ts`        |
| Spectral Lint             | API-Konventionen                | `npx @stoplight/spectral-cli lint apps/api/openapi/lokaltreu-openapi-v2.0.yaml`        | `reports/openapi/spectral.txt`         |
| schema_drift=0            | Schema-Stabilität               | `npm run -w packages/types test:schema-drift` | `reports/openapi/schema-drift.txt`     |
| Contract-Tests (RFC 7807) | API-Fehlerform                  | Prism + `npm run test:contract`               | `reports/contract/results.json`        |
| Anti-Replay               | Idempotency-Verhalten           | `npm run test:security:anti-replay`           | `reports/security/anti-replay.log`     |
| Device-Proof              | Signaturprüfung                 | `npm run test:security:device-proof`          | `reports/security/device-proof.log`    |
| GDPR                      | Datenschutz                     | `node scripts/check-*`                        | `reports/gdpr/*`                       |
| Terraform validate        | IaC Qualität                    | `terraform fmt -check && terraform validate`            | `reports/infra/terraform-validate.txt` |

**PR-Checkliste:** Wird in [docs/AGENTS.md](../AGENTS.md) referenziert.  
**Required Checks:** `ci`, `security-gates`, `gdpr-compliance`.
