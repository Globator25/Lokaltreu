# Datenschutz-Folgenabschätzung (DPIA) – Lokaltreu SaaS

## 1. Beschreibung der Verarbeitung

- SaaS „digitale Stempelkarte“ (Merchant-Portal, Mitarbeiter-UI, PWA für Endkunden ohne Login)
- Rollen grob: Betreiber Lokaltreu SaaS (Verantwortlicher für Betriebs-/Sicherheitsverarbeitung), Infrastruktur-/Support-Dienstleister (Auftragsverarbeiter), Händler als Mandanten/Nutzer
- Datenflüsse: Card-ID ↔ Stempel-/Prämien-API, Device-ID ↔ Mitarbeiter-Geräte und Security-Logs, Audit-Events mit tenant_id, action, result, ip, ua, jti

## 2. Bewertung Notwendigkeit und Verhältnismäßigkeit

- Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Betrieb, Sicherheit, Fraud-Prevention)
- Endkunden ohne Login, Nutzung pseudonymer Card-IDs und technischer Kennungen (tenant_id, device_id)
- Logs als personenbezogene Daten, 180 Tage Aufbewahrung für Audit, Incident-Response und Missbrauchserkennung
- Datenminimierung: Logs enthalten nur notwendige IDs + technische Metadaten (z. B. IP, User-Agent); keine Freitextfelder, keine Namen, E-Mail-Adressen o. Ä.

## 3. Risikobewertung

- Risiken: Kontoübernahme von Händler-Admins, Missbrauch von Mitarbeiter-Geräten, Token-/Device-Key-Leaks
- Risiken: Fraud/Sammeln von Stempeln ohne Berechtigung (Replay, Brute-Force, Umgehung von Rate-Limits)
- Risiken: Datenpannen im Log-/Backup-Bereich (unberechtigter Zugriff, Restore ohne erneute Löschung)
- Risiken: Unvollständige DSR-Erfüllung bei pseudonymen Endkunden (Art.-11-Szenarien)

## 4. Maßnahmen zur Risikominimierung

- WORM-Audit-Logs mit 180 Tagen Retention, regelmäßige signierte Exporte in EU-Object-Storage; Zugriff nur für Audit-Officer nach „least privilege“
- Sicherheitsmechanismen: Rate-Limits pro Tenant/IP/Card/Device, Anti-Replay (z. B. Idempotency-Key, Redis SETNX), Device-Proof (Ed25519-Signatur)
- Einheitliches Fehlerformat nach RFC 7807 inkl. technischer `error_code`, um Fehlerszenarien nachvollziehbar und auditierbar zu halten
- Standardisierte Runbooks (Incident/Breach, Restore, Replay-Verdacht) inkl. Eskalationspfaden und Dokumentationspflichten

## 6. Art.-11-DSR-Pfad (grobe Beschreibung)

- Keine zusätzliche Identifizierung der betroffenen Person (kein Sammeln zusätzlicher PII, keine Ausweiskopien etc.)
- Eingang der Anfragen typischerweise über DSR-UI/Support mit vorhandenen Kontexten (z. B. Card-ID, Device-ID, ggf. Referenz auf Request-Logs)
- Ablauf: Eingang → Matching auf bestehende Kontexte → Auskunft/Löschung soweit möglich → Tombstone-Eintrag bei Löschung → Bestätigung an die betroffene Person
- Falls keine hinreichende Identifizierung möglich: Antwort nach Art. 11 Abs. 2 DSGVO mit Erklärung der eingeschränkten Rechte-Erfüllung und Hinweis auf Log-/Backup-Strategie

## Backups & DSR

- Backups (DB, Storage) werden aus Integritäts- und Nachvollziehbarkeitsgründen **nicht selektiv editiert**.
- Lösch-DSR erfolgt über eine Tombstone-Liste `deleted_subjects`:
  - Felder u. a.: `subject_identifier`, `reason`, `deleted_at`.
  - Jede erfolgreiche Lösch-DSR erzeugt einen Tombstone-Eintrag.
- Im Restore-Fall wird die Tombstone-Liste erneut auf die restaurierten Daten angewendet:
  - Betroffene Subjekte werden nach Restore erneut gelöscht oder pseudonymisiert.
- Logs bleiben während der 180 Tage Retention nur für Betriebs-/Sicherheitszwecke verfügbar; danach automatische Löschung gemäß Retention-Policy.
- Verhalten und Zuständigkeiten sind konsistent in AVV, RoPA, Retention-Policy und Infos-DE beschrieben.
