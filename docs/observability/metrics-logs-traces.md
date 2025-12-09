# Observability – Metrics, Logs, Traces (EU)

Quelle: [SPEC §19], [ROADMAP Schritte 8, 37, 41, 47], [AGENTS §6–§7], [infra/PROVIDERS.md]. Alle Signale werden ausschließlich in EU-Regionen verarbeitet (Fly/Render, Neon, Upstash, Cloudflare R2, Loki/Tempo/Grafana EU-Stack).

---

## 1. Signal-Stack

| Signal | Tool / Storage (EU) | Erfassung | Retention / Export |
| --- | --- | --- | --- |
| Metrics | OpenTelemetry → Prometheus/Grafana Cloud (EU) | API & PWA instrumentiert, p50/p95/p99 pro Route, rate_* KPIs | 30 Tage online, Snapshots nach R2 (180 Tage) |
| Logs | Loki (EU cluster) | Structured JSON Log (tenantId, deviceId, cardId, correlation_id) | 30 Tage hot; Audit-relevante Events zusätzlich WORM → R2 |
| Traces | Tempo (EU) | W3C TraceContext; spans für /stamps/claim, /rewards/redeem, Referrals | 14 Tage; Kryo-Export nach R2 für kritische Releases |
| Alerts | Grafana Cloud (EU) / PagerDuty EU | SLO-Breach, Fehlscan-Spike >5/60 s/Tenant, cost_per_tenant Anomalie | Runbooks verlinkt (Incident-Breach) |

---

## 2. Pflichtmetriken

- **Leistung:** p50/p95/p99 für `/stamps/claim`, `/rewards/redeem`, `/devices/registration-links`, `/referrals/*`.  
- **Fehler:** `error_4xx_rate`, `error_5xx_rate`, `rate_token_invalid`, `rate_token_reuse`, `429_rate`.  
- **Security:** Device-Proof-Failures, Idempotency-Key-Reuse, Break-Glass events (Counter).  
- **Plan/FinOps:** `plan_usage_percent`, `plan_warning_emitted`, `cost_per_tenant`, `time_to_upgrade_effective`.  
- **Infra:** Redis latency, Postgres connections, queue depth.

Metriken werden per OpenTelemetry SDK in API & Web erfasst; Lint-Regel `otel-required` stellt sicher, dass neue Routen instrumentiert sind (vgl. `docs/CI-Gates.md` Abschnitt 6).

---

## 3. Logs

- Strukturierte JSON-Logs mit Feldern: `ts`, `tenantId`, `deviceId`, `cardId`, `correlation_id`, `action`, `result`, `latency_ms`.  
- Keine PII (keine IPs in Audit-Log; IPs nur in Betriebs-Logs mit Art. 6 Abs. 1 lit. f-Begründung).  
- Log-Level: `info` für Geschäftsereignisse, `warn` für Rate-Limits/Planwarnungen, `error` für Failures.  
- Log-Shipper sendet in EU-Loki; Export nach 30 Tagen via signiertes Bundle in Cloudflare R2 (180 Tage WORM).  
- correlation_id in Problem+JSON erlaubt Support-Trace ohne PII.

---

## 4. Traces

- W3C TraceContext (traceparent/tracestate) propagiert vom Client (PWA) zur API.  
- Spans decken komplette Abläufe ab (Token-Erzeugung, Claim, Redeem, Referral).  
- Attributes: `tenant.id`, `device.id`, `route`, `plan`, `cache.hit`, `redis.latency`.  
- Sampling: 20 % baseline, 100 % für Fehler-/Slow-Spans (p95 > 3 s) via tail-based sampling.  
- Export nach Tempo (EU); wöchentliche Snapshots (JSON/OTLP) in R2.

---

## 5. Alerts & Dashboards

- Dashboards pro Environment (dev/stage/prod) mit identischer Panel-Struktur, verlinkt aus `docs/CI-Gates.md` und Runbooks.  
- Alerts triggern PagerDuty EU escalation; Runbooks: JWKS-Rotation, Replay-Suspected, Incident-Breach.  
- Mindestens einmal pro Quartal: „Trocken-Incident" mit Status-Page-Eintrag (Roadmap Schritt 47).

---

## 6. Governance & CI-Verankerung

- `ci.yml` verifiziert, dass OTEL-Instrumentierung vorhanden ist (lint).  
- `observability-snapshot` Job prüft, dass Dashboard-Exports < 7 Tage alt sind.  
- FinOps-Skripte (`scripts/validate-cost-metrics.ts`) sichern `cost_per_tenant`-Alert-Thresholds.  
- Änderungen an Observability-Stack benötigen Review durch Test-Pilot + Infra-Engineer; Referenzieren dieses Dokument und `docs/CI-Gates.md`.

---

## 7. DSGVO & Retention

- Observability-Daten verbleiben in EU; DPAs für Grafana Cloud/Loki/Tempo hinterlegt.  
- Logs metriken-spezifisch anonym; Audit-Logs unterliegen 180-Tage-Retention + signierter Export.  
- DSR/Tombstone-Flow: Bei Löschung von Card-ID werden zugehörige Logs/Traces via `deleted_subjects`-Liste gepurged oder pseudonymisiert (vgl. `docs/05-Compliance.md`).  
- Backups/Exports landen in Cloudflare R2 (EU) mit Lifecycle-Regeln.
