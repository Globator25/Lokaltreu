# Runbook: Rollback

**Use-case:** Schneller Rollback nach fehlerhaftem Deploy (dev/stage/prod).

## Trigger (eine Bedingung reicht)
- P1/P2-Incident, Kernrouten fehlschlagen, 5xx-Rate ↑, p95/p99 außerhalb SLO.
- Healthchecks rot oder Deploy-Canary fällt durch.
- Kritische Regression nach Release.

## Vorbedingungen
- Letztes **stabiles** Release/Artefakt bekannt und **gepinnt**.
- Migrationsstatus geklärt (irreversible Migrationen erkannt).
- Oncall/Stakeholder informiert, Change-/Incident-Ticket offen.

## Schritte – Actions (empfohlen)
1. **Stabiles Artefakt bestimmen**  
	- Tag/Run-ID notieren (z. B. `vX.Y.Z` oder CI-Run-URL).
2. **Traffic/Jobs dämpfen**  
	- Feature-Flags off, Worker pausieren, optional Read-only.
3. **Rollback ausführen**  
	- `deploy`-Workflow starten, Ziel-Environment wählen, **stabiles Artefakt** auswählen/pinnen.  
	- Bei `stage/prod`: Environment-Approval einholen.
4. **Smoke-Tests**  
	- `/health` grün.  
	- API (dry-run): `/v1/stamps/claim`, `/v1/rewards/redeem`.  
	- Web: App lädt, kritischer Flow startet.
5. **Überwachen (30–60 min)**  
	- 5xx-Rate normalisiert, p95/p99 im Rahmen, Errors abnehmend.
6. **Kommunikation & Audit**  
	- Decision Log aktualisieren: Zeitpunkt, Artefakt/Tag, Grund, Ergebnis.  
	- Status an Stakeholder.

## DB-Migrationen
- **Reversible** Migrationen: Rollback der Migration ausführen.  
- **Irreversible**/datenverändernde Migrationen: **kein** Code-Rollback ohne DB-Restore → `restore-db.md` befolgen.

## Abbruchkriterien / Eskalation
- Smoke-Tests weiterhin rot oder Metriken bleiben schlecht → Incident hochstufen, `restore-db.md` prüfen, Ursachenanalyse intensivieren.

## Nacharbeiten
- Root Cause Analyse starten.  
- Fix vorbereiten und als **roll forward** nach Tests ausrollen.  
- Lessons learned + Monitoring/Tests/Runbooks aktualisieren.
