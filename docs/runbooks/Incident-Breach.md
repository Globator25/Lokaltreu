# Runbook: Incident & Breach Response

> Break-Glass / Emergency Access: siehe AGENTS. TODO: link to AGENTS.md Break-Glass section.

## Purpose & Scope
Handlungsrahmen für Sicherheits- oder Datenschutzincidents (SLO-Breach, Security-Verdacht, Datenverlust). Ziel: Stabilisierung, Eindämmung, Kommunikation, Compliance (72‑h Meldung) gemäß `docs/04-Security-and-Abuse.md` und `docs/05-Compliance.md`.

## Triggers / Detection
- Alerts (p95/p99 SLO, 5xx/429-Spike, rate_token_reuse, cost_per_tenant-Anomalien).
- Security- oder Abuse-Hinweise (Device-Proof-Verletzung, Verdacht auf Replay, Datenexfiltration).
- Externe Meldungen (Kunde, Auditor, Provider) oder interne Pen-Test-Funde.
- **Breach suspected:** Anhaltspunkte, dass Vertraulichkeit/Integrität/Verfügbarkeit personenbezogener oder tenantbezogener Daten verletzt sein könnten (z. B. Audit-Log zeigt unautorisierte Zugriffe, Datenexporte, Verlust von Tombstone-Einträgen). Sobald „Breach suspected“ festgestellt wird, 72h-Pfad aktivieren.

## Responsibilities & Escalation
- **Incident Commander (IC):** setzt Severity (P1–P4), koordiniert Ablauf.
- **Scribe:** führt Timeline, sammelt Evidenz.
- **Comms Lead:** verantwortet interne/externe Kommunikation.
- **Domain Leads (API, Web, DB, Infra, Security, Compliance):** liefern technische Analysen.
- Eskalation an CTO + Datenschutzbeauftragte bei Personenbezug oder SLO-Verletzung.

## Preconditions / Prechecks
- Incident-Channel eröffnet, Rollen bestätigt.
- Severity festgelegt; falls P1/P2 → Rund-um-die-Uhr-Bereitschaft.
- Zugriff auf Observability (metrics/logs/traces), Audit-Daten, IaC.
- Checkliste Break-Glass: notieren, falls nötig (aber keine Durchführung hier).

## Procedure
### Block 1 – Erstklassifizierung & Containment
1. IC dokumentiert Scope, Startzeit, betroffene Tenants/Services.
2. Identifiziere Hypothesen, sammle erste Datenpunkte (correlation_id, device_id, card_id).
3. Aktiviere Sofortmaßnahmen (Rate-Limits verschärfen, Features deaktivieren, Traffic umleiten, Blue→Green Switch falls relevant).
- **Verifikation:** Severity bestätigt, Maßnahmen greifen (Fehlerkurven stabilisieren), Logging aktiv.

### Block 2 – Analyse
1. Sammle Logs/Traces/Deploy-Diffs, ordne im Decision-Log.
2. Reproduziere Problem auf Stage/Dev falls möglich.
3. Validere Hypothesen nacheinander; dokumentiere Ergebnisse.
- **Verifikation:** Mindestens eine Hypothese bestätigt/verworfen mit belegten Daten, Scribe aktualisiert Timeline.

### Block 3 – Remediation / Rollback
1. Rollback auf letztes stabiles Artefakt (siehe `docs/runbooks/blue-green.md`) oder Hotfix mit minimalem Blast-Radius.
2. Führe Smoke-Tests aus (`/health`, Token-Issues, Device-Proof-Dry-Run) und prüfe Observability.
3. Falls Break-Glass nötig: nur nach AGENTS §5 mit Audit-Eintrag.
- **Verifikation:** Fehlerquote sinkt, Smoke-Tests grün, Alerts zurück unter Schwelle.

### Block 4 – Exit & Nachbereitung
1. Prüfe Exit-Kriterien (Stabilität, Monitoring normal, Stakeholder informiert).
2. Plane Postmortem (≤5 Werktage) inkl. Maßnahmen, Owner, Fälligkeiten.
3. Aktualisiere Runbooks/Tests/Alerts, falls Lücken identifiziert.
- **Verifikation:** IC gibt Incident offiziell frei, Tickets auf Follow-up gesetzt.

## Rollback
Abhängig von gewählter Remediation. Nutze spezialisierte Runbooks (z. B. `JWKS-Rollback`, `Restore`). Dokumentiere Entscheidungsgrundlage im Incident-Log.

## 72h Timeline & Checklist
- **T0 – Erkennung:** IC bestätigt Incident, Severity setzen, Incident-ID vergeben, Timeline starten (UTC). Break-Glass-Bedarf dokumentieren (nur nach AGENTS §5; TODO: direkten Link ergänzen, sobald verfügbar).
- **T0 + 4h (Triage/Scope):** Domain Leads liefern erste Fakten (Scope, betroffene Tenants, potenzielle Datenklassen). Entscheidung: Breach suspected? Ja → Compliance in Call, 72h-Zähler läuft.
- **T0 + 24h (Zwischenstand):** Executive Brief, Status-Page/Customer Draft vorbereiten. Prüfen, ob weitere Datenpunkte fehlen; offene Fragen und geplante Maßnahmen dokumentieren (Ticket + Incident-Board).
- **T0 + 72h (Meldepfad):** Legal/Compliance + Security Lead entscheiden, ob Behördenmeldung (Art. 33/34 DSGVO) notwendig ist. Evidenzpaket bereitstellen (Timeline, Logs, Impact-Assessment). Freigaben dokumentieren (Rollen, Zeit, Inhaltszusammenfassung). Nach Entscheidung: Meldung absenden oder begründete Nicht-Meldung festhalten.

## Evidence & Audit Artifacts
- Incident-Timeline mit UTC-Timestamps, Severity-/Rollen-Entscheidungen, Break-Glass-Vermerke.
- Problem+JSON-/Response-Beispiele (IDs), Logs/Metrics-Exports (PII-frei, correlation_id enthalten), Screenshots Observability, Rate-Limit-Dashboards.
- Decision-Log (Containment, Remediation, 72h-Meldeentscheidung) inkl. verantwortlicher Rollen.
- Postmortem-Report, Follow-up-Tasks, Compliance-Notizen.
- Ablage: `docs/postmortems/<incident-id>/` + `artifacts/incidents/<id>/` + Audit-Speicher (z. B. R2).

## Communication
- **Intern:** Incident-Channel Updates alle 15–30 Min (P1/P2); Incident Board trackt Maßnahmen. Domain Leads und Scribe pflegen Status. Executive Briefs bei T0+24h und vor 72h-Entscheidung.
- **Extern (Kunden/Partner):** Comms Lead erstellt faktenbasierte Updates (Status-Page, Kundenmails) nur nach Security + Legal Freigabe. Keine PII oder Spekulationen.
- **Behörden/Regulatoren:** Compliance/Legal entscheidet über Meldung, koordiniert Inhalte, sammelt Nachweise. Support-/Customer-Success-Teams erhalten abgestimmte FAQ.

## Dry-run Protocol
| Datum (YYYY-MM-DD) | Teilnehmer (Rollen) | Szenario | Annahmen (Signals/Alerts) | Durchlaufene Schritte (kurz) | Ergebnis/Outcome | Offene TODOs / Follow-ups | Evidenz abgelegt unter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | IC, Security Lead, Comms Lead, Compliance | Incident Simulation (Containment + Triage) | Synthetic SLO breach alert | Severity set, containment activated, triage logged | | | |
| YYYY-MM-DD | IC, Security Lead, Compliance, Legal | 72h-Meldepfad Drill | Breach suspected notification | Execute 72h timeline decisions, prep regulator brief | | | |
| EXAMPLE/PLACEHOLDER | 2025-02-20 | IC, Security Lead, Comms Lead, Compliance | Incident dry-run | Alert: simulated data exfil signal | Containment rehearsal, 24h update drafted, 72h decision mock | Outcome: PASS, communication flow validated | TODO: automate evidence checklist | artifacts/incidents/RB-0005/dryrun |
