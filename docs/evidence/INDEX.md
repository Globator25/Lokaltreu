# Audit Evidence Index

Belegbare Artefakte nach Step 4. Pfade anpassen, falls Reports anders abgelegt werden.

## Coverage

* `apps/api/coverage/coverage-summary.json`
* `apps/web/coverage/coverage-summary.json`
* Reproduktion: `npm run -w apps/api test -- --coverage --run`, `npm run -w apps/web test -- --coverage --run`

## OpenAPI & Schema

* Spectral Report: `reports/openapi/spectral.txt`
* Schema Drift: `reports/openapi/schema-drift.txt`
* Reproduktion: `npx @stoplight/spectral-cli lint apps/api/openapi/lokaltreu-openapi-v2.0.yaml`, `npm run -w packages/types test:schema-drift`

## Contract-Tests (RFC 7807)

* Ergebnis: `reports/contract/results.json`
* Logs: `reports/contract/*.log`
* Reproduktion: Prism Mock + `npm run test:contract`

## Security-Gates

* Anti-Replay: `reports/security/anti-replay.log`
* Device-Proof: `reports/security/device-proof.log`

## GDPR

* Dokumente vorhanden: `reports/gdpr/docs-present.txt`
* Retention: `reports/gdpr/retention-180.txt`
* Log-Scan: `reports/gdpr/no-pii.txt`
* Terraform EU-only: `reports/gdpr/terraform-eu-only.txt`

## Terraform

* Validate Output: `reports/infra/terraform-validate.txt`

## Hinweise

* Alle Checks laufen automatisiert in `.github/workflows/*.yml`
* Required Checks für Merge: `ci`, `security-gates`, `gdpr-compliance`
