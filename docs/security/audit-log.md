## Zweck

- Audit-Log dient Fraud-Prevention, Forensik und Nachweis der Sicherheitskontrollen (SPEC v2.0 Schritte 14–16).

## Rechtsgrundlage

- Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
- Art. 11 DSGVO: DSR-Prozess ohne Identifizierungspflicht.

## Retention / WORM

- Aufbewahrung 180 Tage.
- Export nach Cloudflare R2 (EU-Jurisdiction) pro Tag, signiert (Ed25519) und unveränderlich (WORM).
- `flushAuditLogs()` (apps/api/src/audit/auditEvent.ts) stößt den signierten Export an; keine Mutation bestehender Dateien.

## Events (Pflichtfelder: `ts`, `tenantId`, `actorType=device`, `deviceId`, `action`, `result`, `ip`, `userAgent`, `jti`, `requestId`)

- `secure_action.ok` – Erfolgreiche sensitive Aktion (Anti-Replay bestanden).
- `secure_action.blocked_replay` – Replay erkannt, Token verworfen, `rate_token_reuse` metrisch erfasst.
- `secure_device.ok` – DeviceProof erfolgreich validiert.
- `secure_device.proof_failed` – DeviceProof fehlgeschlagen (Grund in `reason`), `deviceProofFailed` metrisch erfasst.
- (Übrige Business-Events wie `device.register`, `stamp.token.issued`, `reward.redeemed`, `referral.*` bleiben bestehen.)

## Implementierung (Tech)

- Append-only JSON Lines (`./var/audit/<YYYY-MM-DD>.log.jsonl`) – keine Überschreibung, kein Löschen.
- `auditEvent()` schreibt synchron, `flushAuditLogs()` wird vom Export-Worker/CI aufgerufen und überträgt die Signaturpakete nach R2 (EU, 180 Tage Retention).
- Production nutzt Upstash Redis (EU) als Anti-Replay-Backend (`REPLAY_STORE=redis`) für Idempotency Keys (TTL 60s, SETNX).
- DeviceProof erzwingt ±60s Zeitfenster und auditloggt jeden Versuch (SPEC Roadmap Schritt 15/16).

## Log Hygiene

- Globale Error-Logs enthalten ausschließlich Korrelation (`correlation_id`/`requestId`), Route und Fehlerklasse – keine Roh-IP, keine vollständigen User Agents.
- IP/UA werden nur im Audit-Log gespeichert (WORM) zur Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO / Art. 11 DSGVO.
