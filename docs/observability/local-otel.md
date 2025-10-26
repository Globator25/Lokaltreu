# Local OTEL

The local stack exposes OTLP/HTTP at http://localhost:4318.

## Apps in Docker
Point to the collector service inside Compose:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_RESOURCE_ATTRIBUTES=service.name=my-app,deployment.environment=local
```

## Apps on the host (Windows/macOS/Linux)
Use localhost:

```
# PowerShell (session)
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
$env:OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
$env:OTEL_TRACES_EXPORTER="otlp"
$env:OTEL_METRICS_EXPORTER="otlp"
$env:OTEL_LOGS_EXPORTER="otlp"
$env:OTEL_RESOURCE_ATTRIBUTES="service.name=my-app,deployment.environment=local"
```

Verify (simple POST):

```powershell
$env:OTEL_SERVICE_NAME="dev-check"; curl http://localhost:4318/v1/traces -Method POST
```

## Helpful npm scripts
- Pre-deploy hygiene: `npm run obs:predeploy`
- Quick verification: `npm run obs:verify`
