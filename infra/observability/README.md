# Observability – Schritt 8 (Dev/Stage)

Lokaltreu setzt auf ein Mock-First/Contract-Sync-Vorgehen. Für Schritt 8 bedeutet das: Telemetrie wird bereits in Dev/Stage konsequent über OpenTelemetry (OTel) erfasst und per OTLP an einen Collector gesendet. Dieser README dient als auditierbare Zielbeschreibung.

## Zielbild

- **OTel via OTLP**  
  Alle Services senden Metriken/Traces/Logs über OTLP (`grpc`/`http`) an einen Collector (lokal z. B. `infra/observability/local/docker-compose.yml`).  
- **Standard-Resource-Attribute**  
  - `service.name` – `lokaltreu-api`, `lokaltreu-web` etc.  
  - `deployment.environment` – `dev` oder `stage`.  
  - `service.version` (optional) – Git-Commit oder SemVer.  
- **Traffic-Quellen**  
  Label `traffic.source` mit erlaubten Werten `user`, `synthetic`, `loadtest`. Keine Query-Parameter/Headers/Bodies als Labels.
- **FinOps-Gauges**  
  API liest ausschließlich ENV-basierte Kostenschätzungen (siehe Tabelle) und publiziert sie als `lokaltreu_finops_*` Gauges – keine externen Billing-APIs oder PII.

## No-Gos

- **Keine PII** in Telemetrie (keine IPs, Bodies, Freitext, Kundendaten).  
- **Keine Gate-Bypässe** – Observability darf CI-, Security- oder GDPR-Gates nicht umgehen; alle Änderungen laufen durch reguläre Reviews.

## Start (Dev)

1. `docker compose -f infra/observability/local/docker-compose.yml up -d`  
   - Startet Collector (OTLP), Prometheus (19090), Grafana (13000).  
2. Setze die Env Vars (siehe Tabelle) z. B. in `.env.local` oder via `cross-env`.  
3. `npm run mock:api` (falls API-Contract getestet wird) oder `npm run dev -w apps/api`.  
4. Die Anwendung sendet OTLP an `http://localhost:4317/4318`.

## Verify (Dev)

1. `curl http://localhost:19090/-/ready` → `Prometheus is Ready`.  
2. `curl http://localhost:13000/api/health` (Grafana) → `200`.  
3. Prüfe Metrik `http_server_requests_total{traffic.source="user"}` über Grafana/Prometheus-UI.  
4. Sichere, dass `traffic.source` gesetzt ist (Standard `user`, Loadtest-Skripte setzen `loadtest`).  
5. Optional: `npm run test:observability-smoke -w apps/api` – sendet Stub-Requests und verifiziert, dass der lokale Collector Metriken liefert (Env: `OBS_ENABLE_CONTRACT_STUBS=true`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`).

## Start (Stage)

1. Stage-Collector (z. B. Fly.io/managed) bereitstellen; identische OTLP-Konfiguration (gRPC/HTTP).  
2. Stage-Deployments setzen Env Vars auf Stage-Endpunkte (siehe Tabelle).  
3. `npm run openapi:lint` + reguläre CI/Gates ausführen; danach Deploy-Workflow (`.github/workflows/deploy.yml`).  

## Verify (Stage)

1. Über Grafana/Prometheus Stage-Instanz prüfen, ob `deployment.environment="stage"` Metriken liefert.  
2. Synthetic-Checks (`traffic.source="synthetic"`) bestätigen (z. B. über `.github/workflows/smoke.yml`).  
3. Rate-Limit- oder Error-Metriken dürfen keine PII enthalten; stichprobenartige Kontrollen durchführen.  
4. `npm run test:observability-smoke -w apps/api` gegen Stage (Base-URL/Metric-URL via `OBS_SMOKE_BASE_URL`, `OBS_SMOKE_METRICS_URL`) – Script prüft, ob Telemetrie noch ankommt.

## Env Vars

| Variable | Dev Beispiel | Stage Beispiel | Beschreibung |
| --- | --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | `https://otel-stage.lokaltreu.example:4317` | OTLP gRPC Endpoint (Collector) |
| `OTEL_EXPORTER_OTLP_HEADERS` | `x-otlp-tenant=dev` | `x-otlp-tenant=stage` | Optionaler Header für Multi-Tenant Collector |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.name=lokaltreu-api,deployment.environment=dev` | `service.name=lokaltreu-api,deployment.environment=stage,service.version=${GIT_SHA}` | Standard-Resource-Attribute |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://localhost:4318/v1/metrics` | `https://otel-stage.lokaltreu.example:4318/v1/metrics` | OTLP HTTP (optional) |
| `TRAFFIC_SOURCE` | `user` | `synthetic` / `loadtest` | Wird als Label `traffic.source` verwendet |
| `FINOPS_COST_COMPONENTS_EUR_MONTHLY` | `{"db_storage":12.34,"redis_ops":5.67}` | `{"db_storage":45.00,"redis_ops":11.00,"traffic":19.99}` | JSON mit monatlichen Kosten pro Komponente (EUR); nur deterministische, PII-freie Keys |
| `FINOPS_ACTIVE_TENANTS` | `25` | `200` | Anzahl aktiver Mandanten (integer); Basis für `lokaltreu_finops_cost_per_tenant_eur_monthly` |

> Hinweis: Werte können pro Service variieren. Entscheidend ist, dass alle Metriken anonymisiert bleiben und über OTLP laufen.

## Weiteres Vorgehen

- Schritt 8 ist bestanden, wenn Dev/Stage dieselben Collector- und Tagging-Regeln verwenden, alle neuen Endpunkte OTLP nutzen und `traffic.source` durchgängig gesetzt wird.  
- Änderungen an Env Vars, Collector-Konfiguration oder Dashboards müssen versioniert und in PRs dokumentiert werden.
