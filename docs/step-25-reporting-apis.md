# Schritt 25 – Reporting-APIs (Roadmap 2.3.1)

## Ziel
Bereitstellung von Reporting-Endpunkten für tenant-isolierte KPI-Übersichten und Zeitreihen, contract-first (OpenAPI SSOT), testbar (Mock-/Contract-First) und DSR-konform (Tombstones).

## Implementierte Endpunkte (OpenAPI SSOT)
- `GET /reporting/summary`
- `GET /reporting/timeseries`

OpenAPI: `apps/api/openapi/lokaltreu-openapi-v2.0.yaml`

## Funktionale Abdeckung (Kurz)
- Aggregierte KPIs pro Tenant (Summary)
- Zeitbasierte Metriken (Timeseries, day/week/month)
- Tenant-Isolation in Aggregaten
- DSR/Tombstones: tombstoned Subjects werden in Aggregationen ausgeschlossen

## Test-/Nachweis (lokal)
Im Projekt-Root (`./`):

```powershell
npm run -w packages/types build
npm run lint
npx @stoplight/spectral-cli lint --ruleset .\.spectral.yaml .\apps\api\openapi\lokaltreu-openapi-v2.0.yaml
npm test --workspaces
