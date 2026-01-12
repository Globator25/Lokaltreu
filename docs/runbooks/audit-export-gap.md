# Runbook: Audit Export Gap (Step 24)

## Zweck
Überwacht Export-Lücken der WORM-Audit-Exporte pro Tenant. Compliance-kritisch:
Gap > 15 Minuten erfordert sofortige Untersuchung.

## Auslöser
- Alarm/Alert: `audit export gap exceeded`
- KPI: `audit_gaps_count` > 0

## Sofortmaßnahmen
1. Prüfe, ob der Export-Job läuft und die letzten Runs SUCCESS sind.
2. Prüfe Object Storage: existieren neue Export-Artefakte (`events.ndjson`, `meta.json`, `meta.sig`)?
3. Prüfe DB: letzter SUCCESS in `audit_export_runs` je Tenant.

## Diagnose
1. Job manuell ausführen:
   - `npm -w apps/api run audit:monitor:gap`
   - `npm -w apps/api run audit:export:worm`
2. Fehlerursachen:
   - DB-Verbindung (AUDIT_EXPORT_DB_DSN)
   - Storage-Creds (S3/R2)
   - Signatur-Key (AUDIT_EXPORT_KEY_ID / AUDIT_EXPORT_PRIVATE_KEY)

## Recovery
1. Behebe Ursache (DB/Storage/Keys).
2. Export-Job erneut starten.
3. Prüfe, ob `audit_export_runs` SUCCESS erzeugt wird.

## Nachbereitung
- KPI wieder auf 0 setzen (Gap Events müssen auslaufen).
- Incident dokumentieren und Runbook aktualisieren.
