# Windows PowerShell: OTEL, Checks und VS Code

## Session vs. Persistent OTEL Variablen

- Session (nur aktuelles Terminal):

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "https://lokaltreu-obs-tempo.fly.dev:4318"
$env:OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
$env:OTEL_RESOURCE_ATTRIBUTES    = "service.name=my-app,service.version=dev,deployment.environment=dev"
$env:OTEL_LOGS_EXPORTER          = "otlp"
$env:OTEL_TRACES_EXPORTER        = "otlp"
$env:OTEL_METRICS_EXPORTER       = "otlp"
```

- Persistent (User) + sofortige Session-Übernahme:

```powershell
$vars = @{
  OTEL_EXPORTER_OTLP_ENDPOINT  = 'https://lokaltreu-obs-tempo.fly.dev:4318'
  OTEL_EXPORTER_OTLP_PROTOCOL  = 'http/protobuf'
  OTEL_RESOURCE_ATTRIBUTES     = 'deployment.environment=dev'
}
$vars.GetEnumerator() | % {
  [Environment]::SetEnvironmentVariable($_.Key, $_.Value, 'User')
  $env:($_.Key) = $_.Value
}
```

- Optional ins $PROFILE markieren:

```powershell
'${vars-json-hier-nicht-notwendig}' | Out-Null  # Marker im Profile
```

- Geheimnisse (Fly):

```powershell
$env:OTEL_BEARER_TOKEN = "<token>"
flyctl secrets set OTEL_BEARER_TOKEN=$env:OTEL_BEARER_TOKEN -a <app>
```

## BOM/UID-Checks

- Read-only Prüfung lokal:

```powershell
pwsh -NoProfile -File scripts/verify-bom-and-uid.ps1
```

- In CI und Smoke-Workflow automatisch aktiv.

## VS Code

- Tasks: siehe `.vscode/tasks.json` (OBS: Provider UTF-8, UID Dedupe, Grafana Health)
- Launch: API (OTEL) und Web (OTEL) in `.vscode/launch.json`

## Nützliche NPM-Skripte

```powershell
npm run obs:verify:readonly   # BOM/UID read-only
npm run obs:predeploy         # Provider UTF-8 + Dedupe
npm run obs:health:all        # Grafana, Tempo, Loki
```

## Persistente User-Variablen setzen

```powershell
$pairs = @{
  "OTEL_EXPORTER_OTLP_ENDPOINT" = "https://lokaltreu-obs-tempo.fly.dev:4318"
  "OTEL_EXPORTER_OTLP_PROTOCOL" = "http/protobuf"
}
foreach($k in $pairs.Keys){ [Environment]::SetEnvironmentVariable($k,$pairs[$k],"User") }
# Verifikation in neuer Shell:
[Environment]::GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT","User")
```

## Machine-Scope Variablen (optional)

Erfordert Administratorrechte; wirkt für alle Nutzer:

```powershell
Start-Process pwsh -Verb RunAs -ArgumentList @"
-NoProfile -Command "[Environment]::SetEnvironmentVariable('OTEL_EXPORTER_OTLP_ENDPOINT','https://lokaltreu-obs-tempo.fly.dev:4318','Machine')"
"@
```
