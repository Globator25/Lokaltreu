# Observability Stack (Loki, Tempo, Grafana, OpenTelemetry)

Zweck: Zentrale Telemetrie für Logs, Metriken und Traces (EU-Region).

Komponenten:
- Grafana (Dashboards, Alerts)
- Loki (Logs)
- Tempo (Traces)
- OpenTelemetry Collector (Empfang + Weiterleitung)

Start (lokal):
```bash
docker compose up -d
