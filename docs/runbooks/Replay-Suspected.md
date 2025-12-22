# Runbook: Replay-Suspected

> Break-Glass / Emergency Access: siehe AGENTS. TODO: link to AGENTS.md Break-Glass section.

## Purpose & Scope
Analyse und Eindämmung bei Verdacht auf Replay-/Token-Missbrauch (Stempel oder Prämieneinlösung). Bezieht sich auf Redis-Anti-Replay (`SETNX`, TTL 60 s), Device-Proof und Idempotency-Kontrollen.

## Triggers / Detection
- Spikes in „replay rejected“ / „nonce already used“ / „idempotency conflict“ Metriken oder Alerts (`rate_token_reuse`, `rate_token_invalid`).
- Rate-Limit- oder Abuse-Alarme (z. B. card_id-/device_id-Velocity, Plan-Limit-Anomalien).
- Support-/Inhaber-Meldungen über doppelte Stempel/Prämien sowie Log-Hinweise mit `correlation_id`, `tenant_id`, `device_id`.

## Responsibilities & Escalation
- **Security Analyst:** führt forensische Auswertung durch, Owner der Maßnahmen.
- **API Tech Lead:** prüft Backend-Logs und Idempotency.
- **Comms Lead:** koordiniert Kundenkommunikation falls Impact >1 Tenant.
- Eskalation an Incident Commander bei SLO-Bedrohung oder Betrugsverdacht.

## Preconditions / Prechecks
- Ticket/Incident-ID mit initialer Severity (mind. P2 bis Impact geklärt).
- Zugriff auf Audit-Logs (card_id, device_id, tenant_id), Redis-/Anti-Replay-Metriken, OTel-Traces.
- Liste aktiver Geräte und Rate-Limit-Konfigurationen; Plan-Limits bekannt.
- `docs/04-Security-and-Abuse.md` und Anti-Replay-Spezifikation griffbereit (TTL ≤60 s, Device-Proof Zeitfenster ±30 s lt. SPEC).
- Evidenz-Speicher vorbereitet (`artifacts/security/<incident-id>/replay/`), Chain-of-custody dokumentierbar.

## Procedure
### Block 1 – Validieren & Triage
1. Sammle Pseudodaten (`correlation_id`, `tenant_id`, `device_id`, `card_id`) aus Alerts/Logs; sichere Kopien in Evidenz-Ordner.
2. Vergleiche Zeitfenster mit Anti-Replay TTL (≤60 s) und Device-Proof-Zeitfenster (±30 s). Notiere Abweichungen.
3. Prüfe Idempotency-Key Nutzung, Client-Retry-Muster und Rate-Limit-Historie, um legitime Retries (z. B. Netzwerk-Fehler) von Replay-Versuchen zu unterscheiden (Kriterien: gleicher Body, identische correlation_id, Timing << TTL).
4. Documentiere Entscheidung (Verdacht bestätigt/entkräftet) inkl. Kriterien.
- **Verifikation:** Triage abgeschlossen, Hypothese begründet im Ticket.

### Block 2 – Eindämmung
1. Aktiviere temporäre Schutzmaßnahmen: strengere Rate-Limits, zusätzliche Monitoring-Alerts, Sperrung spezifischer device_id oder Kampagnen via Admin-Oberfläche/Konfiguration (keine adhoc-Skripte).
2. Informiere betroffene Inhaber über laufende Untersuchung (nur Fakten, keine PII) und protokolliere Sperrentscheidungen.
3. Sammle Screenshots/Exports der Metriken vor/nach Maßnahmen.
- **Verifikation:** Schutzmaßnahmen aktiv, Alerts stabilisieren sich oder fallen unter Schwelle.

### Block 3 – Forensik & Wiederherstellung
1. Führe „Forensik-light“ durch: Audit-Log-Auszüge, Device-/Token-Status, Rate-Limit-Historien sammeln (nur pseudonyme IDs). Notiere Chain-of-custody (wer, wann, welche Daten).
2. Markiere verdächtige Stempel/Prämien für manuelle Korrektur (Ticket), kein direktes Löschen in Produktion.
3. Bewerte Business-/FinOps-Auswirkungen und plane Nacharbeiten (z. B. Tests, neue Kontrollen).
- **Verifikation:** Alle betroffenen Ereignisse katalogisiert, Folgeaufgaben erstellt.

## Rollback
Wenn Massnahmen (z. B. Rate-Limit-Erhöhungen) den Normalbetrieb beeinträchtigen, nach zwei stabilen Stunden Limits zurückfahren. Dokumentation aktualisieren, SLO überwachen.

## Evidence & Audit Artifacts
- Logs/Traces (pseudonymisierte IDs), Rate-Limit-/Replay-Metrik-Exports, Screenshots OTel-Dashboards.
- Timeline mit UTC-Timestamps, Entscheidungen (Rollen), Device-Sperrlisten.
- Ablage: Ticket-System + `artifacts/security/<incident-id>/replay/`, ggf. Audit-Speicher (R2).

## Communication
- Sofortmeldung an betroffene Inhaber via Support (faktenbasiert, keine PII).
- Status-Page optional („Degraded security safeguards“) bei größerem Impact.
- Eskalation zu Incident Commander/Security & Compliance, wenn Replay confirmed, SLO gefährdet oder Personenbezug vermutet.

## Dry-run Protocol
| Datum (YYYY-MM-DD) | Teilnehmer (Rollen) | Szenario | Annahmen (Signals/Alerts) | Durchlaufene Schritte (kurz) | Ergebnis/Outcome | Offene TODOs / Follow-ups | Evidenz abgelegt unter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Security Analyst, API Tech Lead | Replay-Alert Simulation | Synthetic `rate_token_reuse` spike | Collect logs, triage, apply temporary limits | | | |
| YYYY-MM-DD | Security Analyst, IC, Compliance | Incident-Eskalation Drill | Escalated abuse alert | Trigger incident path, communication rehearsal | | | |
| EXAMPLE/PLACEHOLDER | 2025-02-18 | Security Analyst, API Tech Lead | Replay dry-run | Alert: simulated nonce reuse spike | Triage logs, enforce stricter limits, capture evidence | Outcome: PASS, detection latency <5m | TODO: automate metric export | artifacts/security/RB-0004/replay-dryrun |
| 2025-12-16 | Security Analyst, IC, Compliance | Replay tabletop drill | Alert: synthetic replay burst | Outcome: PASS, mitigations validated | STEP9-DRILL-004 | TODO: script metric snapshot |

## Trockenlauf-Protokoll

| Datum | Rollen | Szenario | Annahmen/Signals | Ergebnis | Evidenz | TODOs |
|---|---|---|---|---|---|---|
| EXAMPLE/PLACEHOLDER | YYYY-MM-DD | Incident Commander (IC), Security Lead, Platform On-Call | <kurz> | <kurz> | Ticket-ID / artifacts/... | <kurz> |
| 2025-12-16 | Incident Commander (IC), Security Lead, Platform On-Call | Replay drill follow-up | Alert: replay detection normal | Outcome: PASS | STEP9-DRILL-004 | TODO: automate evidence upload |
