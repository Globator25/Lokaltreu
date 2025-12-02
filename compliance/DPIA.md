# Datenschutz-Folgenabschätzung (DPIA) – Lokaltreu SaaS

## 1. Beschreibung der Verarbeitung

<!-- TODO: Kurzbeschreibung digitale Stempelkarte, Rollen, Flows -->

## 2. Bewertung Notwendigkeit und Verhältnismäßigkeit

- Endkunden ohne Login, pseudonyme Card-IDs
- Minimierte Daten in Logs (keine Namen, nur IDs/IP/UA)

## 3. Risikobewertung

<!-- TODO: Risiken (Account-Übernahme, Missbrauch, Datenpannen) grob skizzieren -->

## 4. Maßnahmen zur Risikominimierung

- WORM-Audit, 180 Tage Aufbewahrung
- Rate-Limits, Anti-Replay, Device-Proof
- Backups & Restore nach definierter Strategie

## 5. Backups & DSR

- Backups (DB, Storage) werden aus Integritäts- und Nachvollziehbarkeitsgründen **nicht selektiv editiert**.
- Für Lösch-DSR wird eine Tombstone-Liste `deleted_subjects` geführt:
  - Felder u. a.: subject_identifier, reason, deleted_at.
  - Jede erfolgreiche Lösch-DSR erzeugt einen Tombstone-Eintrag.
- Im Restore-Fall wird die Tombstone-Liste erneut auf die restaurierten Daten angewendet:
  - Betroffene Subjekte werden nach Restore erneut gelöscht oder pseudonymisiert.
- Dieses Verhalten ist in AVV, RoPA und Retention-Policy konsistent beschrieben.

## 6. Art.-11-DSR-Pfad (grobe Beschreibung)

- Keine zusätzliche Identifizierung der betroffenen Person
- Matching auf vorhandene Kontexte (z. B. Card-ID, Device-ID)
- Auskunft/Löschung soweit möglich
- Falls keine Identifizierung möglich: Antwort nach Art. 11 Abs. 2 DSGVO



