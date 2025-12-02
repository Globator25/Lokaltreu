# Verzeichnis von Verarbeitungstätigkeiten (RoPA) – Lokaltreu SaaS

## 1. Händlerverwaltung & Kampagnen

<!-- TODO: Zweck, Kategorien, Rechtsgrundlage, Empfänger, Löschfrist -->

## 2. Betriebs-/Sicherheitslogs

- Zweck: Betriebssicherheit, Missbrauchserkennung, Fraud-Prevention
- Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
- Betroffene: Händler (Admin), Mitarbeiter-Geräte, technische Endkundendaten (pseudonyme IDs)
- Datenkategorien: IP-Adresse, User-Agent, tenant_id, device_id, card_id
- Aufbewahrung: 180 Tage
- Besonderheit: DSR nach Art. 11 ohne zusätzliche Identifizierung

## 3. Backups und Disaster Recovery

- Zweck: Wiederherstellung nach Ausfällen
- Hinweis: Backups werden nicht selektiv editiert
- Verweis auf Tombstone-Konzept (deleted_subjects)
