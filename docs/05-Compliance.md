# Compliance – Lokaltreu

Dieses Dokument fasst die Datenschutzstrategie, regulatorischen Anforderungen und Nachweisführung von Lokaltreu zusammen. Quellen: [SPEC §8], [ROADMAP Schritte 2, 34, 41–48], [AGENTS §1, §4, §9], [DPIA], [RoPA], [TOMs].

---

## 1. Rechtsgrundlagen & Grundsätze

- **Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse):** Betrieb des Treuesystems, Sicherheit (Anti-Replay, Device-Proof), Abuse-Prävention und Plan-Limits. Interessenabwägung in der DPIA dokumentiert.  
- **Art. 11 DSGVO (keine zusätzliche Identifizierung):** Endkunden-PWA arbeitet pseudonym über Card-IDs; DSR-Prozess (UI + API) erfordert keine weiteren Identitätsdaten.  
- **Privacy by Design / Datensparsamkeit:** Keine Speicherung von Klarnamen, E-Mail-Adressen oder Telefonnummern von Endkunden. Mandanten- und Geräte-IDs sind pseudonym.  
- **Zweckbindung & Minimierung:** Logs enthalten nur tenant_id, device_id, card_id, jti, correlation_id; keine IPs in Audit-Log (nur in Betriebs-Logs mit Rechtsgrundlage per Art. 6 Abs. 1 lit. f).  
_Quelle: [SPEC §2.3, §7, §8], [DPIA], [AGENTS §1]_

---

## 2. Dokumentations- & Nachweispflichten

- **RoPA:** Alle Verarbeitungstätigkeiten (Onboarding, Gerätebindung, Stempel, Redeem, Referral, DSR, Reporting) inklusive Rechtsgrundlage und Löschfristen.  
- **TOMs:** Technische/organisatorische Maßnahmen (Device-Proof, Anti-Replay, Rate-Limits, WORM-Audit, Break-Glass).  
- **DPIA:** Risikoanalyse für QR-Token, Referral-Gate, Gerätebindung, Tombstone-Konzept; jährlich überprüft, bei Änderungen aktualisiert.  
- **Retention Policy:** Definiert 180-Tage-Aufbewahrung, Exporte nach R2, automatisierte Löschung.  
- **GDPR-Checks in CI:** `gdpr-compliance.yml` prüft Existenz und Grundstruktur aller Artefakte (Roadmap Schritt 2).  
_Quelle: [ROADMAP Schritte 2, 42], [AGENTS §6], [Compliance Ordner]_

---

## 3. Datenstandorte & Auftragsverarbeitung

- **EU-only Hosting:** API (Fly/Render EU), Postgres (Neon EU), Redis (Upstash EU), Object Storage (Cloudflare R2 EU), Mail (Mailjet/Brevo EU).  
- **AVV/DPAs:** Für jeden Provider unterzeichnet und im Compliance-Ordner versioniert.  
- **Backups:** In EU-Regionen gespeichert; Zugriff nur für Admin-Rolle zwecks Restore-Runbooks.  
- **Status-Page & Monitoring:** Auch in EU gehostet, enthält keine personenbezogenen Daten.  
_Quelle: [SPEC Infrastrukturabschnitt], [ROADMAP Schritte 6–8, 47–48]_

---

## 4. Aufbewahrung, Löschung & Tombstone-Modell

- **Audit-/Security-Events:** 180 Tage WORM-Speicherung, danach Export + Löschung.  
- **DSR / Art.-17-Anfragen:** Endkunde triggert Löschung über PWA (Schritt 34). Die Anfrage erzeugt einen Eintrag in `deleted_subjects`.  
- **Backups & Restore:** Backups werden nicht selektiv verändert; nach Restore wird die Tombstone-Liste erneut angewendet, sodass gelöschte Subjekte nicht wiederhergestellt werden.  
- **Plan-Daten & Reporting:** Aggregierte Statistiken werden ohne Personenbezug gehalten; Rohdaten unterliegen ebenfalls der 180-Tage-Frist.  
_Quelle: [SPEC §8], [ROADMAP Schritte 23, 34, 48], [Retention Policy]_

---

## 5. Betroffenenrechte & Transparenz

- **Art.-11-DSR-Flow:** PWA-Formular für Card-ID + optionalen Kontaktkanal; Statusansicht und Audit-Log-Eintrag.  
- **Informationspflichten:** Datenschutzhinweise (Infos-DE) verlinkt in PWA und Admin-Dashboard; enthält Rechtsgrundlagen, Datenempfänger, Aufbewahrung.  
- **Support-Traceability:** Problem+JSON liefert `correlation_id`, sodass Supportanfragen ohne PII beantwortet werden können.  
- **Break-Glass-Nachvollziehbarkeit:** Jeder Einsatz wird geloggt, Ticket erstellt, Gates wiederhergestellt.  
_Quelle: [ROADMAP Schritte 34, 42], [AGENTS §5], [Infos-DE]_

---

## 6. Consent & Cookie-Policy

- **Kein Cookie-Banner für Kernfunktionen:** Nur technisch notwendige LocalStorage-Einträge (Tokens, Card-State). Nutzung basiert auf berechtigtem Interesse.  
- **Optionale Hinweise:** Hinweistext in PWA erklärt Einsatz von LocalStorage/Service Worker. Für optionale Marketing-Funktionen (z. B. Angebotsbanner) werden keine zusätzlichen personenbezogenen Daten erhoben.  
_Quelle: [DPIA], [Infos-DE], [EDPB-Guidelines 05/2020]_

---

## 7. Monitoring & Audits

- **Intern:** Regelmäßige Reviews der Compliance-Artefakte (Docs-Keeper + Audit-Officer).  
- **Extern:** Stage-PenTests + Compliance-Audits (Roadmap Schritte 44–45).  
- **KPIs:** `audit_gaps = 0`, `gdpr-checks = green`, dokumentierte Restore-Tests inkl. Tombstone.  
- **Incident-Pfad:** Runbook Incident-Breach (72 h Meldepflicht, interne/öffentliche Kommunikation via Status-Page).  
_Quelle: [ROADMAP Schritte 41–45], [AGENTS §6–§7], [Runbooks]_
