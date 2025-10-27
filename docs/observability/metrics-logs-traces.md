# Observability-Basis (EU)
- Signale: Metrics, Logs, Traces via OpenTelemetry.
- Speicherung: Logs -> Loki, Traces -> Tempo, Dashboards/Alerts -> Grafana (EU).
- DSGVO: Verarbeitung in EU-Regionen; 180 Tage WORM-Exports (Audit) nach R2 (EU).
- SLO-Ueberwachung: p50/p95/p99 pro Kernroute; 5xx-/429-Rate; Token-Reuse-Events.

## Lokale Observability (dev)
- API läuft lokal auf Port 3001 und stellt `/health` mit HTTP 200 bereit.
- OpenTelemetry NodeSDK exportiert Traces via OTLP gRPC an den lokalen Collector unter `http://localhost:14317`.
- Der Collector leitet Traces an Tempo und Logs an Loki weiter.
- Grafana (Container) dient als UI für Metriken, Logs und Traces.

### Betriebsziele (aus SPEC/NFR)
- Latenz-SLO: p95 ≤ 3000 ms
- Verfügbarkeit (Kernrouten): 99,90 %
- Resilienz: RPO 15 min, RTO 60 min
- Rate-Limits und Replay-Prevention werden später über Redis/Upstash EU erfasst und korrelieren mit Traces.
