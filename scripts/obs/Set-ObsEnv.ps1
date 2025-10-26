param([string]$TempoBase = "https://lokaltreu-obs-tempo.fly.dev")
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT  = "$TempoBase/v1/traces"
$env:OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "$TempoBase/v1/metrics"
$env:OTEL_EXPORTER_OTLP_PROTOCOL         = "http/protobuf"
$env:OTEL_RESOURCE_ATTRIBUTES            = "service.name=lokaltreu-api,service.namespace=obs"
setx OTEL_EXPORTER_OTLP_TRACES_ENDPOINT  $env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT  | Out-Null
setx OTEL_EXPORTER_OTLP_METRICS_ENDPOINT $env:OTEL_EXPORTER_OTLP_METRICS_ENDPOINT | Out-Null
setx OTEL_EXPORTER_OTLP_PROTOCOL         $env:OTEL_EXPORTER_OTLP_PROTOCOL         | Out-Null
setx OTEL_RESOURCE_ATTRIBUTES            $env:OTEL_RESOURCE_ATTRIBUTES            | Out-Null
