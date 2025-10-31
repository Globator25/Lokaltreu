# Security Controls / Replay Protection
- Production setzt auf Upstash Redis (EU) fuer Anti-Replay, Rate-Limits und Queue-Mechanismen. ARCH verlangt explizit EU-Jurisdiction.
- Lokale Entwicklung verwendet automatisch den `InMemoryReplayStore`, Redis ist nicht erforderlich.
- Erfuellt Muss-Anforderung: Anti-Replay via Redis `SETNX(jti)` mit `TTL=60s` fuer alle sensiblen Aktionen (`POST /secure-action`).

## Go-Live Gate
- Audit-Logging mit Retention 180 Tage und Export-Nachweis nach R2 EU.
- Replay-Blocks schreiben verpflichtende Audit-Events.
- Device-Proof-Validierung aktiv, Fehlversuche fuehren zu 403 (RFC7807) und Metrik `deviceProofFailed`.
- Produktion nutzt Upstash Redis EU; lokale Dev nutzt Fallback.
- Secrets liegen ausschliesslich SOPS-verschluesselt vor.
- Observability-Alerts fuer Latenz, rate_token_reuse, deviceProofFailed und fehlende Audit-Exports sind konfiguriert.
