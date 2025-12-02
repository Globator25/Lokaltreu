# Retention Policy – Lokaltreu SaaS

## 1. Grundsätze

- Datensparsamkeit, Zweckbindung
- Logs als personenbezogene Daten, Retention 180 Tage

## 2. Aufbewahrungsfristen nach Datenkategorie


| Kategorie                 | Beispiel                    | Retention          | Bemerkung                    |
|---------------------------|-----------------------------|--------------------|------------------------------|
| Betriebs-/Sicherheitslogs| Access-/Audit-Logs          | 180 Tage           | WORM-Audit, signierte Exporte|
| Rohzähler                 | Stempel-Events              | 180 Tage           | Aggregation in Reporting     |
| Abrechnungsaggregate      | Monatszahlen je Händler     | 10 Jahre (aggregiert) | handelsrechtliche Pflichten |
| Backups DB/Storage        | vollständige Systemabbilder | X Tage/Wochen (TODO) | Nicht selektiv editiert      |

## 3. Backups & DSR

*(Details siehe 2.4)*

## 4. Art.-11-Pfad

- Bezug zur DPIA und Infos-DE

### Backups & DSR

- Backups (DB, Storage) werden aus Integritäts- und Nachvollziehbarkeitsgründen **nicht selektiv editiert**.
- Für Lösch-DSR wird eine Tombstone-Liste `deleted_subjects` geführt:
  - Felder u. a.: subject_identifier, reason, deleted_at.
  - Jede erfolgreiche Lösch-DSR erzeugt einen Tombstone-Eintrag.
- Im Restore-Fall wird die Tombstone-Liste erneut auf die restaurierten Daten angewendet:
  - Betroffene Subjekte werden nach Restore erneut gelöscht oder pseudonymisiert.
- Dieses Verhalten ist in AVV, RoPA und Retention-Policy konsistent beschrieben.

