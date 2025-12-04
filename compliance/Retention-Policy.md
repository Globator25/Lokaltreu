# Retention Policy – Lokaltreu SaaS

## 1. Grundsätze

- Datensparsamkeit, Zweckbindung, Dokumentation je Datenklasse
- Logs als personenbezogene Daten, Retention 180 Tage (Audit, Incident Response)
- Rohzähler (Card-/Device-Events) nur bis Aggregation, danach Löschung bzw. Pseudonymisierung
- DSR erfolgt ohne zusätzliche Identifizierung (Art. 11 DSGVO, Card-/Device-ID Matching)

## 2. Aufbewahrungsfristen nach Datenkategorie


| Kategorie                 | Beispiel                    | Retention             | Bemerkung                           |
|---------------------------|-----------------------------|-----------------------|-------------------------------------|
| Betriebs-/Sicherheitslogs| Access-/Audit-Logs          | 180 Tage              | WORM-Audit, signierte Exporte       |
| Rohzähler                 | Stempel-Events              | 180 Tage              | Aggregation in Reporting, dann Purge|
| Abrechnungsaggregate      | Monatszahlen je Händler     | 10 Jahre (aggregiert) | handelsrechtliche Pflichten         |
| Backups DB/Storage        | vollständige Systemabbilder | 30/60 Tage (TODO)     | Nicht selektiv editiert             |

## 3. Backups & DSR

- Backups (DB, Storage) werden aus Integritäts- und Nachvollziehbarkeitsgründen **nicht selektiv editiert**.
- Lösch-DSR erfolgt über die Tombstone-Liste `deleted_subjects`:
  - Felder u. a.: subject_identifier, reason, deleted_at.
  - Jede erfolgreiche Lösch-DSR erzeugt einen Tombstone-Eintrag.
- Im Restore-Fall wird die Tombstone-Liste erneut angewendet:
  - Betroffene Subjekte nach Restore erneut löschen/pseudonymisieren (automatisierter Prozess TODO).
- Verhalten ist konsistent in AVV, RoPA, DPIA, Infos-DE dokumentiert.

## 4. Art.-11-Pfad

- Verweis auf DPIA (Kap. 6) und Infos-DE (DSR-Abschnitt)
- Keine zusätzliche Identifizierung; Matching Card-ID/Device-ID, ggf. Request-Log
- Ergebnisdokumentation inkl. Hinweis, falls Rechteerfüllung eingeschränkt
- Tombstone-Liste aktualisieren, wenn Löschung möglich; ansonsten Art. 11 Abs. 2 Antwort

