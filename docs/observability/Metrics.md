## Latenz (Histogramm)

Quelle: `http_server_duration_ms` (Histogramm, Einheit Millisekunden) aus dem API-Meter `lokaltreu-api`.

Empfohlene Panels (Prometheus/SigNoz/Grafana Expression):
```
histogram_quantile(0.50, sum by (le, route) (rate(http_server_duration_ms_bucket[5m])))
histogram_quantile(0.95, sum by (le, route) (rate(http_server_duration_ms_bucket[5m])))
histogram_quantile(0.99, sum by (le, route) (rate(http_server_duration_ms_bucket[5m])))
```

Hinweise:
- Dashboard-Fokus auf `/stamps/claim` und `/rewards/redeem`.
- Anzeige split-by `method` und `status`, damit degradierte Responses sichtbar bleiben.
- Ergänzend Durchschnitt (`sum(rate(http_server_duration_ms_sum[5m])) / sum(rate(http_server_duration_ms_count[5m]))`) für Baseline.

## Raten (Counters → Rate)

### error_5xx_rate
- Quelle: `http_server_responses_total` (Counter).
- Abfrage: 
  ```
  sum by (route, method) (rate(http_server_responses_total{status=~"5.."}[5m]))
  ```
- Verwendung: Error-Budget, SLO-Breach.

### 429_rate
- Quelle: `http_server_responses_total`.
- Abfrage:
  ```
  sum by (route, method) (rate(http_server_responses_total{status="429"}[5m]))
  ```
- Optional `tenant`-Label einblenden, sofern Middleware es füllt.

### rate_token_invalid
- Quelle: Counter `rate_token_invalid` aus `metrics-business.ts`.
- Abfrage:
  ```
  sum by (route, tenant) (rate(rate_token_invalid[5m]))
  ```
- Zweck: Fehlscan-/Credential-Stuffing-Erkennung, Alert-Schwelle >5/60 s/Tenant.

### rate_token_reuse
- Quelle: Counter `rate_token_reuse`.
- Abfrage:
  ```
  sum by (route, tenant) (rate(rate_token_reuse[5m]))
  ```
- Zweck: Replay-/Fraud-Erkennung, Trendlinien für Security.

### Ergänzende Log-Zähler
- Loki-Queries: `count_over_time({app="api"} |= "request_failed" [5m]) by (route, status)`.
- Korrelation: `trace_id` und `correlation_id` ermöglichen Drill-down von Rate-Spikes in Tempo/Logs.
