# Runbook: Restore (DB & Audit)

> Break-Glass / Emergency Access: siehe AGENTS. TODO: link to AGENTS.md Break-Glass section.

## Purpose & Scope
Wiederherstellung der zentralen Mandanten-/Audit-Daten (DB/Storage) nach Incident, Datenkorruption oder DR-Test mit minimalem Datenverlust (RPO ≤15 Min) und schneller Wiederanlaufzeit (RTO ≤60 Min). Stellt sicher, dass DSGVO-/Tombstone-Prozesse (deleted_subjects) erneut angewendet werden, damit gelöschte Subjekte nicht wieder auftauchen.

## Triggers / Detection
- Alert auf Datenkorruption, Datenverlust, versehentliches Drop-Statement.
- Infrastruktur- oder Storage-Ausfall (Provider Outage) mit Bedarf auf Restore/Failover.
- Geplanter DR-/Restore-Test laut Roadmap / Compliance.
- Incident-/Breach-Anweisung (z. B. Forensik + Restore auf sauberen Stand).

## Responsibilities & Escalation
- **Incident Commander (IC):** setzt Prioritäten, koordiniert Kommunikation, entscheidet Break-Glass.
- **Platform/DB Lead:** führt Restore/Failover durch, verantwortet Konsistenz.
- **Security Lead:** überwacht Integrität, Anti-Replay-/Device-Proof-Konformität.
- **Compliance/Data Protection Officer:** prüft DSGVO, Tombstone-/DSR-Einhaltung, informiert Behörden falls nötig.
- Eskalation an CTO, falls RTO/RPO gefährdet oder Incident Severity steigt.

## Preconditions / Prechecks
- Restore-Quelle (Backup-ID, Snapshot, Point-in-Time) identifiziert und verifiziert (Hash/Signatur).
- Genehmigtes Change-/Incident-Ticket mit Zeitfenster, Risikoabschätzung, Freigabe (inkl. IC & Compliance).
- Zugriff via Break-Glass gemäß AGENTS Abschnitt „Emergency Break-Glass Deployment“ (nur wenn reguläre Zugriffe blockiert; TODO: direkter Link ergänzen, sobald Referenz verfügbar).
- Isolierte Infrastruktur/Umgebung bereit (kein direktes Überschreiben der produktiven Instanz).
- `deleted_subjects` Tombstone-/DSR-Export verfügbar, inkl. Chain-of-custody-Nachweis.
- Test- und Monitoringpläne vorbereitet (Smoke/Health/Schema, Observability KPIs).

## Procedure
### Block 1 – Incident Stabilisieren
1. Stoppe schreibende Workloads (schreibe-freier Modus via Feature-Flag oder Blue→Green Freeze).
2. Erfasse letzte erfolgreichen Write correlation_id aus WORM-Audit.
3. Stelle sicher, dass Anti-Replay/Device-Proof weiter aktiv ist (nur Leseoperationen zulassen).
- **Verifikation:** Keine neuen Writes im Log, Flags aktiv, Incident-Channel bestätigt Freeze.

### Block 2 – Restore durchführen
1. Führe Restore/Point-in-Time-Recovery in isolierter Umgebung bis zur definierten Zielzeit durch (prozessual; kein provider-spezifisches CLI).
2. Dokumentiere verwendete Backup-ID, Dauer, etwaige Abweichungen.
- **Verifikation:** Restore-Prozess erfolgreich abgeschlossen, Logs bestätigen Abschluss, wiederhergestellte Daten erreichbar.

### Block 3 – Post-Restore Checks
1. Prüfe Health-/Smoke-Tests (API `/health`, PWA-Login/Test-Claim-Modus). Falls konkrete Endpoints unklar → TODO im Ticket.
2. Überprüfe Schema-/Migrationsstand (Schema-Version vs. Repository). Falls Nachweis fehlt → TODO: Schema-Drift-Check durchführen (z. B. Vergleich mit IaC/infra/terraform Outputs).
3. Validere Basisfunktionalität: Schreib-/Leseoperationen in Stage/Isolationsumgebung, Observability KPIs (SLO, Anti-Replay, FinOps) im Normalbereich.
4. Dokumentiere alle Tests inkl. Tool/Script-Referenz, damit Reproduzierbarkeit gewährleistet ist.
- **Verifikation:** Tests grün, Schema konsistent (oder TODO dokumentiert), Monitoring normalisiert, Testnachweise abgelegt.

### Block 4 – DSR/Tombstones erneut anwenden
1. Spiele `deleted_subjects`-/DSR-Entscheidungen erneut ein (Roadmap 2.3.1 Pflicht): markierte Datensätze löschen/pseudonymisieren. Wenn konkrete Automationsschritte unklar sind → TODO: „Provider-spezifischen Reapply-Schritt ergänzen (Link zu infra/terraform Outputs)“.
2. Führe Stichprobenprüfungen mit Pseudonymen (tenant_id/device_id/card_id) durch, um sicherzustellen, dass vormals gelöschte Subjekte nicht wieder sichtbar sind.
3. Dokumentiere Evidenz (Reports, Hashes) und bestätige Compliance-Abnahme.
- **Verifikation:** Stichproben erfolgreich, Compliance Officer bestätigt, Audit-Log zeigt erneute Anwendung; TODOs zu provider-spezifischen Details dokumentiert.

### Block 5 – Cutover nach Prod
1. Hebe Schreib-Sperre auf, sobald neue Instanz produktiv angebunden ist.
2. Überwache RPO/RTO-Erfüllung, Update Incident-Log.
3. Plane Post-Restore-Tasks (Backfill, Re-Exports nach R2).
- **Verifikation:** Produktivtraffic aktiv, keine Fehlerrate, WORM-Exports laufen.

## Rollback
Falls Restore fehlschlägt oder Konsistenzzweifel bestehen: bleibe auf bestehender (eingefrorener) Prod-DB, eskaliere an CTO + Provider. Keine halbautomatische Mischdaten-Schritte.

## Evidence & Audit Artifacts
- Snapshot-ID, Restore-Befehle (abstrakt), Prüfergebnisse (schema_drift, tests), Tombstone-Report.
- Ablage: `artifacts/restore/<ticket-id>/`, Export nach R2.

## Communication
- Intern: Incident-Channel Updates alle 15 Min (P1) inkl. RPO/RTO-Status.
- Extern: Status-Page (degraded/maintenance), Kundenkommunikation über Comms Lead nach Freigabe.
- Behörden: Datenschutz-Officer prüft Meldepflicht (72 h) bei Personenbezug.

## Dry-run Protocol
| Datum (YYYY-MM-DD) | Teilnehmer (Rollen) | Szenario | Annahmen (Signals/Alerts) | Durchlaufene Schritte (kurz) | Ergebnis/Outcome | Offene TODOs / Follow-ups | Evidenz abgelegt unter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | IC, Platform/DB Lead, Compliance | Restore-Drill (Stage) | Planned DR-test alert | Freeze writes, restore snapshot, run smoke tests | | | |
| YYYY-MM-DD | IC, Platform/DB Lead, Security, Compliance | Full DR-Test (Prod-Ready) | Simulated DB corruption alert | Execute full restore + cutover rehearsal | | | |
| EXAMPLE/PLACEHOLDER | 2025-02-15 | IC, Platform/DB Lead, Compliance | Stage restore rehearsal | Alert: scheduled DR-test ticket | Isolated restore, apply tombstones, smoke tests | Outcome: PASS, all checks green | TODO: document schema drift check tool | artifacts/restore/RB-0003/dryrun |
| 2025-12-16 | IC, Platform/DB Lead, Security, Compliance | Restore tabletop drill | Alert: simulated backup corruption | Outcome: PASS, tombstones re-applied | STEP9-DRILL-003 | TODO: automate DSR reapply log |

## Trockenlauf-Protokoll

| Datum | Rollen | Szenario | Annahmen/Signals | Ergebnis | Evidenz | TODOs |
|---|---|---|---|---|---|---|
| EXAMPLE/PLACEHOLDER | YYYY-MM-DD | Incident Commander (IC), Security Lead, Platform On-Call | <kurz> | <kurz> | Ticket-ID / artifacts/... | <kurz> |
| 2025-12-16 | Incident Commander (IC), Security Lead, Platform On-Call | Restore tabletop follow-up | DR-test success signal | Outcome: PASS | STEP9-DRILL-003 | TODO: integrate schema check tool |
