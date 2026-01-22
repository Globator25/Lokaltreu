# Schritt 30 – Spot-Checks (Dashboard Reporting)

Ziel: Aggregierte KPI-Werte aus dem Admin-Dashboard gegen Observability-Metriken abgleichen.
Nur Aggregates, keine PII.

## Spot-Check 1: Stamps (Summary vs. Observability)

- Endpoint: GET /admins/reporting/summary
- KPI-Feld: stamps.day / stamps.week / stamps.month
- Observability-Metrik: stamps.claimed.count (aggregiert)
- Zeitraum: 2025-09-01T00:00:00Z bis 2025-09-07T23:59:59Z
- Erwartung: Summe der Observability-Metrik fuer den Zeitraum stimmt mit den
  day/week/month Aggregaten (Spot-Check) ueberein.

## Spot-Check 2: Rewards (Timeseries vs. Observability)

- Endpoint: GET /admins/reporting/timeseries
- Query:
  - metric: rewards
  - bucket: day
  - from: 2025-09-01T00:00:00Z
  - to: 2025-09-04T00:00:00Z
- Observability-Metrik: rewards.redeemed.count (aggregiert)
- Erwartung: Summe der daily buckets entspricht der Observability-Summe
  fuer denselben Zeitraum.
- Prism-Check: Keine Query-Validation-Errors im Prism-Log (metric/bucket gesetzt).

## Spot-Check 3: Referral Qualified (Timeseries vs. Observability)

- Endpoint: GET /admins/reporting/timeseries
- Query:
  - metric: referral_qualified
  - bucket: week
  - from: 2025-08-01T00:00:00Z
  - to: 2025-09-01T00:00:00Z
- Observability-Metrik: referrals.qualified.count (aggregiert)
- Erwartung: Summe der weekly buckets entspricht der Observability-Summe
  fuer denselben Zeitraum.

## Durchfuehrung (Nachweis) – Prism Mock + Admin Dashboard

- Datum/Zeit: 2025-09-30 14:30
- Modus: Mock/Demo via Prism
- Prism Mock: Spec `apps/api/openapi/lokaltreu-openapi-v2.0.yaml`, Host/Port `127.0.0.1:4010`
- Web UI: `http://localhost:3000/admin/dashboard`
- Env: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4010`, `NEXT_PUBLIC_ADMIN_MOCK_TOKEN=test`
- Ergebnis: `GET /admins/reporting/summary` -> 200, `GET /admins/reporting/timeseries` -> 200
- Prism Validator: "request passed validation rules" (keine Missing metric/bucket, keine Invalid security scheme)
- Screenshot vorhanden
