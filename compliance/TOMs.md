# Technische und organisatorische Maßnahmen (TOMs) – Lokaltreu SaaS

## 1. Zutritts- und Zugangskontrolle

<!-- TODO -->

## 2. Zugriffskontrolle und Rollen

- Single-Admin-Architektur (ein Inhaber je Mandant)
<!-- TODO: weitere Details -->

## 3. Verschlüsselung und Transport

<!-- TODO: TLS erzwungen, PaaS in EU, etc. -->

## 4. Protokollierung und Monitoring

- Betriebs-/Sicherheitslogs mit tenant_id, device_id, card_id
- Aufbewahrung: 180 Tage (siehe Retention-Policy)

## 5. Backup und Restore

- Regelmäßige Backups der Kernsysteme (DB/Storage)
- **Kein selektives Editieren von Backups**
- Verweis auf Tombstone-Konzept in DPIA/Retention-Policy

## 6. Datenschutz durch Technikgestaltung und Voreinstellungen

<!-- TODO: Pseudonyme Card-IDs, Endkunden ohne Login -->
