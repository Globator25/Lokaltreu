# Runbook: JWKS-Rollback

> Break-Glass / Emergency Access: siehe AGENTS. TODO: link to AGENTS.md Break-Glass section.

## Purpose & Scope
Sicherer Rückweg zur letzten bekannten guten JWKS-Version nach fehlerhafter Rotation oder Kompromittierungsverdacht. Fokus auf prod, aber für alle Umgebungen anwendbar. Ziel: Authentifizierung stabilisieren, ohne zusätzliche Risiken oder Downtime zu erzeugen.

## Triggers / Detection
- Anstieg 401/403/5xx unmittelbar nach JWKS-Rotation (z. B. `invalid_signature`, `jwt_validation_errors`).
- Beobachteter falscher/fehlender `kid` in Logs oder Monitoring-Alarm „wrong kid“.
- Security-Meldung über manipulierte JWKS-Datei oder kompromittierten Key.
- Rollback-Kriterien: neue Keys bestehen Overlap-Checks nicht, JWKS-Lint schlägt fehl oder Login/Refresh-Tests brechen ab → sofort Block 1 starten.

## Responsibilities & Escalation
- **Incident Commander (IC):** koordiniert Ablauf (Severity meist P1/P2).
- **Security Lead:** entscheidet, welches JWKS-Backup verwendet wird.
- **Platform Engineer:** führt Wiederherstellung über IaC/Secrets durch.
- Eskalation an Datenschutz-Officer bei Verdacht auf Kompromittierung.

## Preconditions / Prechecks
- Incident-/Change-Ticket mit Severity, Scope, genehmigter Rücknahme.
- Signiertes Backup der letzten funktionierenden JWKS-Version (Hash/Fingerprint dokumentiert, WORM-Lager).
- Zugriff auf Deploy-/Pipeline-System, Observability-Dashboards (metrics/logs/traces).
- Kurzcheck, dass Issue nicht nur Client-spezifisch ist (Status-Page/Support).
- `JWKS-Rotation` Runbook und `Break-Glass` Referenz griffbereit (AGENTS).
- Hinweis: Private Keys niemals in Tickets, Logs oder Chats speichern oder übertragen.

## Procedure
### Block 1 – Sofortmaßnahmen
1. IC verhängt Change-Freeze für Auth/JWKS-Deployments; bestätigte Meldung im Incident-Channel.
2. Sammle Logs/Metrics (401/403/5xx) und relevante `correlation_id` für Evidenz; dokumentiere, welche Kriterien den Rollback ausgelöst haben.
3. Prüfe Break-Glass-Bedarf (nur wenn Deploy-Pipeline blockiert und IC + Security Lead zustimmen).
- **Verifikation:** Freeze dokumentiert, Incident-Channel aktiv, Evidence-Sammlung gestartet.

### Block 2 – Rückkehr zur vorherigen JWKS-Version
1. Identifiziere Backup-Version (Hash, Timestamp) und stelle sicher, dass private Keys offline verbleiben.
2. Deploy JWKS über standardisierten Prozess/Pipeline auf diesen Stand zurück (kein manuelles Prod-Edit).
3. Reaktiviere Overlap/Grace Period: funktionierender `kid` aktiv, neuer problematischer Key bleibt optional im Set, aber wird nicht genutzt.
- **Verifikation:** JWKS-Lint/Healthcheck (`/.well-known/jwks.json`) erfolgreich; Stage/Prod liefern erwarteten `kid`; Login-/Refresh-Smoke-Tests grün; Logs zeigen erfolgreiche Verifikation.

### Block 3 – Key-Entscheidungen & Cleanup
1. Nach Security-Freigabe kompromittierten `kid` deaktivieren/entfernen (prozessual, kein adhoc).
2. Dokumentiere Entscheidung (Rolle, Zeitpunkt) und plane neue Rotation erst nach Ursachenanalyse.
- **Verifikation:** Kein Traffic mit kompromittiertem `kid`, Monitoring stabil.

### Block 4 – Validierung & Abschluss
1. Führe synthetische Checks (Login, Refresh, Device-Proof Dry-Run) sowie JWKS-Endpoint-Tests durch.
2. Überwache `jwt_validation_errors`, 401/403/5xx und Support-Tickets ≥30 Min.
3. Aktualisiere Incident-/Change-Tickets, erstelle Lessons Learned und nächste Schritte.
- **Verifikation:** Fehlerquoten normalisiert, Support meldet Entspannung, Incident Severity reduziert oder geschlossen.

## Evidence & Audit Artifacts
- Incident-/Change-ID, Severity-Änderungen, Entscheidungsträger (IC, Security Lead, Platform Engineer).
- UTC-Timeline (Trigger, Freeze, Deploy, Validation), Hash/Fingerprint der wiederhergestellten JWKS-Version, Begründung für Key-Entzug.
- Logs/Metrics-Exports (`jwt_validation_errors`, 401/403/5xx), Login-/Refresh-Smoke-Test-Protokolle, JWKS-Endpoint-Snapshots, `correlation_id`-Referenzen (PII-frei).
- Ablage: Ticket-System + `artifacts/security/<incident-id>/jwks-rollback/`, zusätzlich Audit-Speicher (z. B. R2) laut `docs/04-Security-and-Abuse.md`.

## Communication
- Intern: Incident-Channel Updates mindestens alle 15 Min (P1/P2); Engineering, Support, Security informiert; Freeze und Erfolgsmeldung dokumentieren.
- Extern: Status-Page auf „degraded/maintenance“ setzen, sobald Kunden betroffen sind; Abschlussmeldung nach erfolgreichem Rollback. Kundensupport erhält faktenbasierte Antworten (keine Key-Details).
- Compliance/Datenschutz: informieren, wenn Personenbezug nicht ausgeschlossen werden kann oder Meldepflicht droht.

## Trockenlauf-Protokoll
| Datum (YYYY-MM-DD) | Teilnehmer (Rollen) | Szenario | Annahmen (Signals/Alerts) | Durchlaufene Schritte (kurz) | Ergebnis/Outcome | Offene TODOs / Follow-ups | Evidenz abgelegt unter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | IC, Security Lead, Platform On-Call | Stage-Rollback | Simulated invalid_signature spike | Initiate freeze, deploy backup JWKS, verify metrics | | | |
| YYYY-MM-DD | IC, Security Lead, Platform On-Call | Prod-Drill (keine Kunden) | Controlled maintenance window | Execute rollback plan end-to-end | | | |
| EXAMPLE/PLACEHOLDER | 2025-02-12 | IC, Security Lead, Platform On-Call | Stage rollback rehearsal | Alert: synthetic invalid_signature spike | Freeze, restore last known JWKS, verify stage client success | Outcome: PASS, ready for prod | TODO: schedule regulator notification playbook review | artifacts/security/RB-0002/jwks-rollback-dryrun |
| 2025-12-16 | IC, Security Lead, Platform On-Call | Rollback criteria drill | Simulated JWKS lint failure | Outcome: PASS, rollback executed | STEP9-DRILL-002 | TODO: document lint automation |
