# Runbook: JWKS-Rotation

> Break-Glass / Emergency Access: siehe AGENTS. TODO: link to AGENTS.md Break-Glass section.

## Purpose & Scope
Rotation der JWT-Verifikationskeys (JWKS) für Admin-/Service-Tokens ohne Downtime. Gilt für dev, stage, prod; umfasst planmäßige Rotationen, Notfallwechsel bei Verdacht auf Kompromittierung und Compliance-getriebene Wechsel.

## Triggers / Detection
- Security-Policy schreibt Rotation in festen Intervallen vor (≥24 h Vorlauf, siehe `docs/04-Security-and-Abuse.md`).
- Monitoring meldet ungewöhnliche `invalid_signature`-/`jwt_validation_errors`-Peaks, Key-Leak-Verdacht oder HSM-Anomalien.
- Audit/Compliance-Order (z. B. SOC2, ISO) verlangt sofortige Rotation.

## Responsibilities & Escalation
- **Security Lead:** Besitzer des Runbooks, genehmigt Keys und Change-Window.
- **Platform On-Call / Platform Engineer:** implementiert Änderungen via IaC/Pipeline, pflegt Secrets.
- **Incident Commander (falls Incident):** eskaliert bei Ausfällen, entscheidet Break-Glass.
- Datenschutzbeauftragte informieren, wenn Kompromittierung personenbezogener Daten nicht ausgeschlossen ist.

## Preconditions / Prechecks
- Genehmigtes Change-/Incident-Ticket mit ID, Risiko, Zeitfenster.
- Vollständige Übersicht der aktiven `kid`, Ablaufdaten, Hash/Sig.
- Zugriff auf Secrets-Management/HSM, dokumentierte Offlinetools (keine Provider-CLI-Anweisungen hier).
- Tests (JWT verification unit/smoke, Device-Proof dry-run) und Monitoring (jwt_validation_errors, login success) bereit.
- `JWKS-Rollback` Runbook verfügbar und Team gebrieft.
- Backup/Snapshot des bisherigen JWKS (WORM, signiert).
- **Security-Hinweis:** Private Keys niemals in Tickets, Logs oder Chats teilen oder speichern.

## Procedure
### Block 1 – Neuen Key generieren
1. Erzeuge neuen privaten Schlüssel (konformes Format, z. B. PEM) in isolierter, abgesicherter Umgebung; vergebe eindeutiges `kid`.
2. Leite nur den Public Key in JWK-Form weiter (kein private Key Export); prüfe Parameter (`kty`, `alg`, `use`, `kid`, `n`, `e` etc.) offline.
3. Dokumentiere Hash/Fingerprint des Public Keys im Ticket.
- **Verifikation:** Key-Lint/Signature-Check bestanden; Hash/Fingerprint abgelegt; keine Logs enthalten Schlüsselmaterial.

### Block 2 – JWK vorbereiten und aufnehmen
1. Ergänze Draft-JWK im JWKS (noch nicht produktiv deployed) und stelle sicher, dass bestehender Key verbleibt (Overlap/Grace Period).
2. Synchronisiere Dev/Stage-Configs oder Feature-Flags, damit beide `kid` akzeptiert werden.
3. Informiere Security Lead + Platform On-Call, dass Stage-Rollout startet.
- **Verifikation:** JWKS enthält beide Keys, Config generiert ohne Fehler, Stage-Clients validieren beide `kid` in Test.

### Block 3 – Veröffentlichung/Deploy
1. Deploy JWKS (mit altem und neuem Key) über standardisierten Prozess/Pipeline (kein manueller Edit, keine Provider-spezifischen CLI-Befehle in diesem Dokument).
2. Warte Grace Period (mindestens zwei Access-Token TTL) bevor alter Key deaktiviert wird.
3. Nach Grace Period: entferne alten Key, sobald Security Lead bestätigt, dass alle Clients den neuen `kid` nutzen.
- **Verifikation:** Monitoring (jwt_validation_errors, invalid_signature, login success) bleibt innerhalb der Basislinie; Logs zeigen neue `kid`-Nutzung; Smoke-Checks (Login, Refresh, Device-Proof) erfolgreich.

### Block 4 – Abschluss & Lessons Learned
1. Aktualisiere Key-Inventar, Tickets, Dokumentation (Datum, `kid`, Hash, verantwortliche Rollen).
2. Erstelle Abschlussnotiz inkl. Zeitstempel, Observability-Screenshots und Lessons Learned.
3. Plane nächstes Rotationstermin/Trockenlauf.
- **Verifikation:** Ticket geschlossen, Audit-Artefakte in Ablage, Monitoring normalisiert.

## Rollback
Bei Validierungsfehlern, Ausfällen oder Kompromittierungsverdacht sofort `docs/runbooks/JWKS-Rollback.md` befolgen. Keine ad-hoc-Konfigurationsänderungen, kein Hardcoding von Keys.

## Evidence & Audit Artifacts
- Change-/Incident-ID, Approval-Referenz, Datum/Uhrzeit jeder Phase.
- Key-Fingerprint/Hash, `kid`, Version der JWKS-Datei (z. B. Git SHA).
- Logs/Metrics-Exports (jwt_validation_errors, login success), Smoke-Test-Protokolle, correlation_id-Beispiele (PII-frei).
- Ablage: Ticket-System + `artifacts/security/<ticket-id>/jwks-rotation/`, Replikation in Audit-Speicher (z. B. R2) gemäß `docs/04-Security-and-Abuse.md`.

## Communication
- Intern: Ankündigung im Engineering-/On-Call-Channel mit Change-Fenster, Updates nach jedem Block, Abschlussmeldung mit Ergebnissen.
- Extern (falls notwendig): Status-Page „Maintenance“ Hinweis vorab; nach Abschluss „completed“ posten. Kundensupport erhält Fact Sheet (kein Key-Material).
- Incident-Szenario: Comms Lead einbinden, RBC (Regulators) nur nach Compliance-Freigabe informieren.

## Dry-run Protocol
| Datum (YYYY-MM-DD) | Teilnehmer (Rollen) | Szenario | Annahmen (Signals/Alerts) | Durchlaufene Schritte (kurz) | Ergebnis/Outcome | Offene TODOs / Follow-ups | Evidenz abgelegt unter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | Security Lead, Platform On-Call | Dry-run Stage Rotation | Monitoring stable, scheduled rotation alert | Generate new key, stage deploy, metrics review | | | |
| YYYY-MM-DD | Security Lead, Platform On-Call, Incident Commander | Failover/Incident Simulation | Invalid signature spike alert | Trigger rollback decision tree, redeploy JWKS, validate | | | |
| EXAMPLE/PLACEHOLDER | 2025-02-10 | Security Lead, Platform On-Call | Stage rotation rehearsal | Planned rotation reminder ticket | Draft key, deploy to stage, verify metrics stay baseline | Outcome: PASS, no issues | TODO: schedule prod exercise | artifacts/security/RB-0001/jwks-rotation-dryrun |
