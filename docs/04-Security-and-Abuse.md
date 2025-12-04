# Security & Abuse – Lokaltreu

MUSS-Anforderungen für Authentifizierung, Anti-Abuse und Audit laut SPEC v2.0, ARCH und CI-Gates.

## AuthN/AuthZ

- Admins authentifizieren sich per kurzlebigem Admin-JWT (HMAC, Rotation ≤24 h) mit Mandanten-ID und Plan-Claims; Refresh erfordert Re-Login.
- Mitarbeitergeräte registrieren sich über Einmal-Link, erzeugen Ed25519-Schlüsselpaare; Public Key im Backend, Private Key verbleibt lokal.
- Kritische Calls (`/stamps/claim`, `/rewards/redeem`, `/devices/*`) SIND mit `X-Device-Proof` zu signieren (payload hash + nonce + timestamp).
- Endkund:innen bleiben anonym; QR-Aufrufe enthalten keine PII, nur card_id + ephemeral token.
- Autorisierung erzwingt Single-Admin-Prinzip: nur eine Admin-Rolle pro Tenant, Geräte erhalten minimalen Scope (stamp, redeem).

## QR/Token & Anti-Replay

- QR-Token enthalten `jti`, `tenant_id`, `card_id`, TTL=60 s und werden serverseitig in Redis (EU-Region) materialisiert.
- Tokens werden bei Ausgabe mit `SETEX` angelegt; beim Einlösen prüft `SETNX` + TTL, um Mehrfachverwendung zu blocken.
- Redis-Namespace pro Tenant; Replay-Deklarationen werden im Audit-Log (`audit_event=replay_blocked`) gespeichert.
- Device-Proof wird pro Token geprüft; fehlender oder ungültiger Proof führt zu HTTP 401 + RFC7807 `type=device_proof_failed`.

## Rate-Limits & Plan-Gates

- Pro Tenant: `1000 stamps/24h`, `200 redeems/24h`; Pro Device: `60 stamps/10m`, `10 redeems/1h`.
- Pro IP (Portal/API): `100 req/5m`; Burst-Limits enforced via API-Gateway + Redis counters.
- Jeder Limitbruch liefert HTTP 429 mit `retry_after` Header und Audit-Eintrag.
- Plan-Gate erzwingt Features: Starter-Plan darf nur Basiskampagne, sonst 403 `PLAN_NOT_ALLOWED`; Plus/Premium prüfen Limits dynamisch.
- Rate/Plan-Limits sind CI-Testpflicht (Parallel-Anti-Replay, Plan-Gate-Tests) und blockieren Merge bei Fehlverhalten.

## Audit & Logs

- Alle sicherheitsrelevanten Aktionen werden in WORM-Audit mit Signatur abgelegt; Aufbewahrung ≥180 Tage (Retention-Job täglich).
- Logs befolgen RFC 7807, enthalten maximal tenant_id/device_id/card_id; keine PII von Endkund:innen.
- DSR-/Plan-/Security-Events erhalten eindeutige `audit_ref` und sind exportierbar via signiertem R2-Archiv.
- Device-Proof-, Anti-Replay- und Rate-Limit-Auslöser erzeugen strukturierte Metriken (`replay_blocks`, `device_proof_failures`).

## Missbrauchsszenarien + Gegenmaßnahmen

- **Duplizierte QR-Codes:** 60 s TTL + Redis Replay-Block + Device-Proof verhindern Mehrfachnutzung; Alerts bei `replay_blocks <100 %`.
- **Geräte-Diebstahl:** Geräte lassen sich serverseitig revoken (`POST /devices/:id/revoke`), Proof erfordert Private Key; Rate-Limits begrenzen Schaden.
- **Plan-Umgehung:** Starter-Admins erhalten Feature-Checks vor jeder API-Aktion; Tests decken 403 `PLAN_NOT_ALLOWED` ab.
- **Mass-Stempelung/Bot:** IP/Device-Limits, Idempotency-Key-Pflicht und Anti-Automation (Proof + TTL) blocken Skripte.
- **Audit-Manipulation:** WORM-Speicher + Signaturen + R2-Exports stellen Unveränderbarkeit sicher; fehlende Artefakte blockieren Deploys.
