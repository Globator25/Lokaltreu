# Nicht-funktionale Anforderungen (NFRs) – Lokaltreu

Verbindliche Qualitätsziele gemäß SPEC v2.0, ARCH und ROADMAP 2.2. Aussagen sind messbar und CI-pflichtig.

## Performance (pro Route)

- `/stamps/claim`: `p50 ≤ 250 ms`, `p95 ≤ 1200 ms`, `p99 ≤ 2000 ms`; gemessen via synthetische Tests + prod tracing.
- `/rewards/redeem`: `p50 ≤ 350 ms`, `p95 ≤ 1500 ms`, `p99 ≤ 2500 ms`; umfasst Rule-Engine + Ledger-Schreibpfad.
- `/devices/register` (GET + POST confirm): `p50 ≤ 400 ms`, `p95 ≤ 1800 ms`, `p99 ≤ 3000 ms`; inkl. Device-Proof-Validierung.
- `/tenants` (POST) + `/campaigns` (POST/GET): `p50 ≤ 500 ms`, `p95 ≤ 2500 ms`, `p99 ≤ 4000 ms`; einschl. Provisionierung.
- Alle übrigen Routen dürfen die genannten Budgets nicht überschreiten; Performance-Benchmarks laufen pro Release.

## Service Levels

- **SLO Hot-Routen:** `/stamps/claim` und `/rewards/redeem` müssen 99,90 % Availability pro rollierende 30 Tage halten; Error Budget max. 43 min/Monat.
- **SLA Intern:** CI/CD blockt Deploys, wenn SLO-Burn >50 % oder Availability-Test rot.
- Downtime-Events müssen im Audit-Log erfasst und mit Ticket-ID dokumentiert werden.

## Resilienz & DR

- RPO ≤ 15 min (continuous WAL-Shipping zu sekundärer Postgres-Instanz + Redis Snapshotting).
- RTO ≤ 60 min (automatisierte Failover-Runbooks, Infrastructure-as-Code Restore).
- Deployments nur auf Multi-AZ-EU-PaaS; alle Stateful-Services (Postgres, Redis, R2) redundant über mindestens zwei AZs.
- Wöchentliche DR-Tests verifizieren Wiederanlauf und Datenkonsistenz.

## Observability & Alerts

- Vollständiger OpenTelemetry-Support (traces + metrics + logs) für API und PWA; Trace sampling ≥ 20 % auf Hot-Routen.
- Pflichtmetriken: `latency_{p50,p95,p99}`, `error_rate`, `device_proof_failures`, `idempotency_replays`, `cost_per_tenant`.
- Alerts:  
  - `latency_p95` > Ziel für 5 min → Pager Idempotency-Guardian/Device-Proof-Engineer.  
  - `error_rate` > 2 % Hot-Routen → Incident P1.  
  - `audit_gap_detected` oder `replay_blocks < 100 %` → Merge-Block.  
  - DSR-Jobs > 24 h Laufzeit → GDPR Eskalation.
- Logs müssen RFC 7807-konforme Fehler enthalten, keine PII außer tenant_id/device_id/card_id.

## FinOps

- `cost_per_tenant` monatlich reporten (Postgres, Redis, R2, CDN, Mail/SMS) und mit Umsatz benchmarks vergleichen.
- Cost-Guards: Rate-Limits und TTLs verhindern unbounded Redis/Postgres-Wachstum; CDN Cache-Hit ≥ 90 %.
- Budget-Alerts ab 80 % Monatsbudget; automatische Abschätzung bei Roadmap-Schritt 1 abgeschlossen.
- Neue Features müssen Kostenkomponente deklarieren (Compute, Storage, Transfer) und FinOps-Review bestehen.
