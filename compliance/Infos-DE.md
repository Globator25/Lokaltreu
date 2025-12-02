# Datenschutzinformationen gemäß Art. 13/14 DSGVO – Lokaltreu SaaS

## 1. Verantwortlicher und Kontaktdaten

- Lokaltreu GmbH (digitale Stempelkarte, Merchant Portal, APIs)
- Datenschutzkontakt: privacy@lokaltreu.example (TODO reale Adresse) / Postanschrift laut Impressum
- Gilt für Händler-Teams, deren Mitarbeitergeräte sowie Endkunden ohne Login

## 2. Zwecke und Rechtsgrundlagen

- Betrieb und Abwicklung der digitalen Stempelkarte / Rewards
- Sicherer Zugriff auf Merchant Portal, POS-Integrationen, Support
- Missbrauchs-, Fraud- und Replay-Prävention inkl. Rate-Limits, Device-Proof
- Rechtsgrundlage jeweils Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Betrieb/Sicherheit)

## 3. Kategorien personenbezogener Daten

- Händler- und Mitarbeiterdaten: Kontaktdaten, Rollen, Audit-Trails
- Pseudonyme Endkundendaten: Card-ID, Device-ID, Reward-Balances
- Technische Metadaten: IP-Adresse, User-Agent, Request-IDs, Plan-/API-Status
- Logs als personenbezogene Daten, Retention 180 Tage (siehe Retention-Policy)

## 4. Empfänger / Kategorien von Empfängern

- Interne Teams (Support, Security, Billing) nach Need-to-know
- EU-basierte Infrastruktur: PaaS, Datenbank, Cache, Storage, Mail-Provider
- Auftragsverarbeiter laut AV-Vertrag; keine Übermittlung in Drittstaaten ohne angemessenen Schutz

## 5. Speicherdauer

- Betriebs-/Sicherheitslogs: 180 Tage WORM-Audit, danach automatische Löschung
- Rohzähler (Card-/Device-Events): 180 Tage bis Aggregation
- Abrechnungsaggregate (Monat/Vertrag): 10 Jahre (aggregiert, handelsrechtlich)
- Backups: siehe Retention-Policy (nicht selektiv editiert, Tombstone-Replay)

## 6. Betroffenenrechte und Umgang mit Anfragen

- Rechte: Auskunft, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch
- Anfragen via Card-ID oder Device-ID (kein zusätzlicher Identitätsnachweis, Art. 11)
- Falls Matching nicht möglich: Hinweis auf eingeschränkte Rechteerfüllung gemäß Art. 11 Abs. 2
- Lösch-DSR → Tombstone-Liste `deleted_subjects`, erneute Anwendung nach Restore
- Detaillierte Abläufe: DPIA Kap. 6, Retention-Policy Kap. 3

## 7. Cookies und LocalStorage

- Nur technisch notwendige Cookies/LocalStorage (Session, Offline-Sync)
- Keine Tracking-Cookies oder Third-Party-Plugins, daher kein Consent-Banner erforderlich
- Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO (Funktionssicherung)
