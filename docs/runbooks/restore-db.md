# Runbook: Restore Database (Neon/PostgreSQL EU)

Scope: Wiederherstellung der Produktionsdatenbank aus Backup (PITR/Snapshot) mit RPO ≤ 15 Min und RTO ≤ 60 Min. Quelle: SPEC §6, ROADMAP Schritt 48, docs/05-Compliance.md.

---

## Vorbedingungen
- Backups/Snapshots vorhanden (Cloudflare R2 + Neon PITR); Zugriffe/Keys geprüft.  
- Wartungsfenster kommuniziert, Oncall & Stakeholder informiert.  
- Rollen benannt: Owner (führt), Scribe (loggt), Reviewer (freigibt).  
- Aktuelle Schema-Version bekannt (z. B. `pnpm prisma migrate status`).  
- `deleted_subjects` Tombstone-Liste aktuell (für späteres Re-Apply).  
- Incident-/Change-Ticket angelegt (dokumentiert RPO/RTO-Ziel).

---

## Schritte

1. **T0 dokumentieren** (UTC) und Ticket/Incident updaten.  
2. **Write-Zugriff sperren:** Wartungsmodus aktiv (API/Workers), DB ggf. read-only, Blue-Green Runbook referenzieren.  
3. **Pre-Restore Sicherung:** Ad-hoc Dump oder Neon Branch vom IST-Zustand (Rollback-Option).  
4. **Zielzeitpunkt wählen:** snapshot/time ≤ RPO (z. B. ISO-Zeit).  
5. **Restore ausführen:**  
   - Neon: PITR zu neuem Branch/DB (z. B. `restore-2025-10-05T1234Z`).  
   - Secrets/Connections noch nicht auf Prod zeigen.  
6. **Migration angleichen:** Schema auf Zielversion (Migrationen up/down).  
7. **Integrität prüfen:**  
   - Tabellen-Counts (`tenants`, `campaigns`, `stamps`, `rewards`, `referrals`).  
   - FK/Constraint-Checks, `SELECT now()` nahe Zielzeit, `pg_is_in_recovery()` = false.  
8. **Tombstone erneut anwenden:** `deleted_subjects` Einträge auf Restore-DB ausführen (Art. 17).  
9. **Canary-Check:**  
   - App gegen Restore-DB in Stage/Read-Only testen (claim/redeem dummy).  
   - Observability (p95/p99, error rate) prüfen.  
10. **Umschalten:**  
    - Secrets/Connection-Strings rotieren, Wartungsmodus deaktivieren, Worker/Jobs stufenweise reaktivieren.  
11. **Überwachen (≥60 Min):** p95/p99, 5xx, Deadlocks, queue depth, cost_per_tenant.  
12. **Audit & Abschluss:** Ticket mit Snapshot-ID, Dauer, RPO/RTO-Einhaltung, Links zu Logs/metrics aktualisieren.

---

## Abbruch-/Rollback-Kriterien
- Integritäts-/Canary-Checks schlagen fehl.  
- Fehler-/Latenzraten außerhalb SLO.  
→ Sofort Rollback auf Pre-Restore-Sicherung, Wartungsmodus aktivieren, Incident eskalieren (Runbook Incident Response).

---

## Hinweise
- Restore-Prozedur regelmäßig in Stage testen (Dokumentation in docs/evidence/).  
- Keine PII in Tickets/Chats; Audit-Exports WORM-konform sichern.  
- Prompt-Log aktualisieren, falls KI genutzt wurde.

---

## Beispielkommandos (PostgreSQL)
```bash
# Pre-Restore Dump
pg_dump --no-owner --format=custom "$DATABASE_URL" -f pre_restore.dump

# Tabellen zählen
psql "$RESTORE_DATABASE_URL" -c "SELECT 'tenants', count(*) FROM tenants;"
psql "$RESTORE_DATABASE_URL" -c "SELECT 'stamps', count(*) FROM stamps;"

# Recovery-Status
psql "$RESTORE_DATABASE_URL" -c "SELECT now(), pg_is_in_recovery();"
```
