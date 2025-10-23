## Alerts

### SLO-Breach (Availability)
- Trigger: Verfügbarkeit der Kernrouten unter 99,90 % im rollierenden 30-Tage-Fenster.
- Messwert: Erfolgsrate (HTTP 2xx/3xx) aus `http_server_responses_total` für `/stamps/claim` und `/rewards/redeem`.
- Reaktion: PagerDuty/On-Call eskalieren, Incident eröffnen, Postmortem einplanen.

### Fehlscan-Spike
- Trigger: `rate_token_invalid` > 5 Events je 60 s pro Tenant.
- Messwert: Rate über `rate_token_invalid` (Grafana `sum by (tenant)(rate(...[1m]))`).
- Reaktion: Security-Channel informieren, Tenant analysieren, Rate-Limits prüfen.

### Queue-Backlog
- Trigger: Warteschlange überschreitet definierte Schwelle (z. B. > 30 s über 5 aufeinanderfolgende Messwerte).
- Messwert: Queue-Wartezeitmetriken aus Worker/Job-System.
- Reaktion: On-Call warnen, zusätzliche Worker skalieren oder Incident eröffnen.
