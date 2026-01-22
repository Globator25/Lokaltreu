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
