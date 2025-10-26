Smoke-Test (Happy Path)
  1. Starte API und stelle OTLP-Endpunkte zu Tempo bereit.
  2. Führe je zehn erfolgreiche Requests auf /stamps/claim und /rewards/redeem aus.
  3. Erwartet:
       - Neue Spans/Traces in Tempo für beide Routen.
       - Histogramm http_server_duration_ms mit aktualisierten Buckets für die Hot-Routen.
       - Logs enthalten trace_id und correlation_id; Stichprobe via Loki (oder stdout) dokumentieren.

Negativ-Test (Token-Abweichungen)
  1. Sende Requests mit ungültigen Tokens (z. B. falsche Signatur) → Erwartet: rate_token_invalid steigt für betroffenen Tenant.
  2. Wiederhole einen gültigen Token-Request (Replay) → Erwartet: rate_token_reuse steigt.
  3. Alarm-Monitoring beobachten:
       - Fehlscan-Spike-Alert löst aus, sobald > 5 rate_token_invalid Events / 60 s / Tenant auftreten.
       - Dashboard-Panel zeigt erhöhte Raten; Screenshot zur Nachweisführung im Testprotokoll ablegen.

Nachbereitung
  - Ergebnisse und Screenshots im QA-Lauf dokumentieren (Confluence/QA-Runbook).
  - Alerts nach Test wieder zurücksetzen (Acknowledgement in Monitoring-Tool).
