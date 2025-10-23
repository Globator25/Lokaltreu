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

## Proxy-Tests (IPv6/IPv4)

Wenn öffentliche Endpunkte nur per IPv6 erreichbar sind, nutze lokal den Fly-Proxy:

```powershell
# Tempo
flyctl proxy 3200:3200 -a lokaltreu-obs-tempo
Invoke-WebRequest http://localhost:3200/ready -TimeoutSec 30 | Select-Object StatusCode

# Loki (intern 3100)
flyctl proxy 3100:3100 -a lokaltreu-obs-loki
Invoke-WebRequest http://localhost:3100/ready -TimeoutSec 30 | Select-Object StatusCode
```

## Öffentliche Health-Checks (Windows TLS Hinweis)

Unter Windows nutzt `curl.exe` standardmäßig Schannel. Bei TLS-Inspection/Policy-Problemen hilft oft OpenSSL-curl und/oder explizit TLS 1.2:

```powershell
# OpenSSL-curl (Git for Windows)
& "C:\Program Files\Git\usr\bin\curl.exe" -4 --max-time 20 https://<app>.fly.dev/ready

# PowerShell (TLS 1.2, ohne HTTP/2)
Invoke-WebRequest https://<app>.fly.dev/ready -TimeoutSec 30 -SslProtocol Tls12 -MaximumRedirection 0 -DisableKeepAlive
```

## Loki Push (Windows)

PowerShell-Skript für einen Testeintrag, inkl. TLS1.2/HTTP1.1-Workarounds:

```powershell
pwsh -NoProfile -File scripts/obs/Push-LokiLog.ps1 -App lokaltreu-obs-loki -Tenant lokaltreu -Message 'hello'
```

Falls `Invoke-RestMethod` weiterhin blockt, den optionalen Curl-Pfad aktivieren:

```powershell
pwsh -NoProfile -File scripts/obs/Push-LokiLog.ps1 -UseCurlFirst
```

## Per-App Deploy (Repo-Root vs. Subfolder)

- Aus Repo-Root deployen (per-app `fly.toml` referenziert lokalen Dockerfile):
  - `flyctl deploy -a lokaltreu-obs-tempo`
  - `flyctl deploy -a lokaltreu-obs-loki`
  - `flyctl deploy -a lokaltreu-obs-grafana`
- Aus App-Unterordner deployen (Dockerfile heißt lokal `Dockerfile`): im jeweiligen `apps/obs/<app>/` ausführen: `flyctl deploy`

## Schritt-6-Checkliste (kurz)

```powershell
npm run obs:verify:readonly
npm run obs:provider:utf8
npm run obs:dedupe:dry; npm run obs:dedupe
npm run obs:health:all
flyctl auth whoami
```
