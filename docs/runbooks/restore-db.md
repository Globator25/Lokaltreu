# Runbook: Restore Database

**Scope:** Wiederherstellung der Produktionsdatenbank aus Backup (PITR/Snapshot).

## Vorbedingungen (alle erfüllt)
- Backups verfügbar (R2/S3 oder Provider-Snapshots) + Restore-Credentials.
- **RPO ≤ 15 min**, **RTO ≤ 60 min** bestätigt.
- Wartungsfenster kommuniziert, Oncall/Stakeholder informiert.
- Rollen benannt: Owner (führt), Scribe (loggt), Reviewer (freigibt).
- Aktuelle Migrationsversion bekannt (z. B. via `prisma migrate status`).

## Schritte
1. **T0 festhalten** (UTC-Timestamp) und Incident/Change-Ticket öffnen.
2. **Schreibzugriff sperren**: App in Wartungsmodus, Worker/Jobs pausieren, DB ggf. read-only.
3. **Pre-Restore-Sicherung**: ad-hoc Dump/Branch des IST-Stands erstellen (Notfall-Rollback).
4. **Zielzeitpunkt wählen**: Snapshot/Time ≤ RPO bestimmen (z. B. `2025-10-05T12:34:00Z`).
5. **Restore ausführen** (Provider-Workflow, z. B. Neon PITR/Snapshot → neue DB/Branch):
	- Auf isolierte Instanz/Branch restoren.
	- Verbindungen/Secrets **nicht** auf Prod schalten.
6. **Migrationsstand angleichen**: Schema auf Zielversion bringen (Up/Down je nach Bedarf).
7. **Integrität prüfen** (alle müssen grün):
	- Checksums/Counts kritischer Tabellen (z. B. `users`, `stamps`, `rewards`).
	- Sanity-Queries (z. B. jüngste Events, FK-Violations = 0).
	- `SELECT now()` ~ Zielzeit; `SELECT pg_is_in_recovery()` = false.
8. **Canary-Check**:
	- App gegen Restore-DB im Staging oder kurzzeitig in Prod per Read-Only-Probe.
	- Kernrouten Dry-Run (claim/redeem Testpfad).
9. **Umschalten**:
	- Connection-Strings/Secrets auf Restore-DB rotieren.
	- Wartungsmodus aufheben, Worker/Jobs stufenweise reaktivieren.
10. **Überwachen** (mind. 30–60 min):
	 - p95/p99, 5xx, Deadlocks, Slow Queries; Fehlerbudgets im Rahmen.
11. **Audit & Abschluss**:
	 - Ticket mit Run-Links, Snapshot-ID, Dauer, RPO/RTO-Einhaltung aktualisieren.

## Abbruch-/Rollback-Kriterien
- Integritäts- oder Canary-Checks fehlschlagen.
- 5xx-Rate/Latency außerhalb SLO.
→ Sofort **Rollback** auf Pre-Restore-Sicherung, Wartungsmodus aktiv, Incident eskalieren.

## Hinweise
- Restore-Prozedur regelmäßig in **stage** testen und Messergebnisse dokumentieren.
- Keine personenbezogenen Daten in Tickets/Chats posten.

## Beispielkommandos (PostgreSQL, anpassen)
```bash
# Pre-Restore-Sicherung
pg_dump --no-owner --format=custom "$DATABASE_URL" -f pre_restore.dump

# Tabellen zählen (Beispiel)
psql "$RESTORE_DATABASE_URL" -c "SELECT 'users', count(*) FROM users;"
psql "$RESTORE_DATABASE_URL" -c "SELECT 'stamps', count(*) FROM stamps;"

# Recovery-Status
psql "$RESTORE_DATABASE_URL" -c "SELECT pg_is_in_recovery();"
```
