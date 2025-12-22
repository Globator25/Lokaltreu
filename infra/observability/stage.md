# Observability Stage (Schritt 8)

Dieses Dokument beschreibt, wie Lokaltreu in **Stage** OTLP-Telemetrie für API und PWA konfiguriert.

## 1. Env Vars (Stage)

| Service | Variable | Wert (Beispiel) | Notizen |
| --- | --- | --- | --- |
| API | `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://otel-stage.lokaltreu.example:4318` | OTLP HTTP Endpoint (Collector). Keine Secrets im Repo, tatsächlicher Host liegt in Secrets/Deploy-Pipeline. |
| API | `OTEL_SERVICE_NAME` | `lokaltreu-api` | Konstant. |
| API | `DEPLOYMENT_ENVIRONMENT` | `stage` | Wird als Resource-Attribut exportiert. |
| API (optional) | `SERVICE_VERSION` | `${GIT_SHA}` | wird von CI/Pipeline gesetzt. |
| PWA | `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` | `https://otel-stage.lokaltreu.example:4318` | Muss identisch zur API-Var sein. |
| PWA | `NEXT_PUBLIC_OTEL_SERVICE_NAME` | `lokaltreu-web` | Default, kann überschrieben werden. |
| PWA | `NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT` | `stage` | Für Resource-Attribute im Browser. |

Diese Variablen werden in der Stage-Pipeline gesetzt: `.github/workflows/deploy.yml` (Input `env=dev` aktuell; Stage-Pipeline analog) bzw. Fly.io Secret-Store (API) und Vercel- bzw. Next.js-Env (PWA). Keine Secrets im Repo ablegen.

## 2. Startup-Log

API (`apps/api/src/observability/otel.ts`) kann optional ein Log schreiben: `[observability] OpenTelemetry SDK started (endpoint=https://otel-stage.lokaltreu.example)`. Host/Schema ohne Token. Keine Query-/Header-Werte loggen.

## 3. Verifikation

1. Stage Deploy ausführen (`deploy` Workflow oder Fly CLI).  
2. In Stage-App (PWA) eine Aktion auslösen (z. B. `/stamps/claim` Stub).  
3. Im Collector/Prometheus prüfen: `service.name="lokaltreu-api", deployment.environment="stage"`.  
4. Browser-Netzwerkpanel → Fetch-Requests enthalten `traceparent` & `x-correlation-id`.  
5. Kein Log enthält IP/Body/PII; stichprobenartig prüfen.

## 4. No-Gos

- Keine Secrets (Tokens/Keys) in Logs, Env-Dateien oder Dashboards.  
- Keine CI-, Security- oder GDPR-Gate-Umgehung.  
- Kein fallback auf „dev“ in Stage-Deployments; bei Fehler Deploy stoppen und Ticket eröffnen.
