# Compliance – Lokaltreu

Dieses Dokument beschreibt die Datenschutzstrategie und regulatorische Einordnung des Lokaltreu-Systems gemäß DSGVO und begleitenden Dokumentationspflichten.

---

## 1. DSGVO-Rechtsgrundlage

- **Art. 6(1)(f) – berechtigtes Interesse**  
  Die Verarbeitung erfolgt zur Bereitstellung eines digitalen Treuesystems mit minimaler Datenerhebung.  
  Interessenabwägung dokumentiert in [DPIA].

- **Art. 11 – keine Identifizierung erforderlich**  
  Endkunden bleiben anonym, solange keine Prämie eingelöst wird.  
  Es erfolgt keine Speicherung personenbezogener Daten ohne Zweckbindung.

_Quelle: [DOC:REQ §7], [DOC:LEGAL], [DPIA Lokaltreu]_

---

## 2. Dokumentationspflichten

- **RoPA (Verzeichnis von Verarbeitungstätigkeiten)**  
  Alle API-Endpunkte und Datenobjekte sind in [RoPA Lokaltreu] dokumentiert.

- **TOMs (Technische und organisatorische Maßnahmen)**  
  Zugriffskontrolle, Audit-Logs, Token-Handling, Replay-Schutz, Rate-Limits  
  Siehe [TOMs Lokaltreu].

- **DPIA (Datenschutz-Folgenabschätzung)**  
  Risikoanalyse für QR-Token, Gerätebindung und Prämieneinlösung  
  Siehe [DPIA Lokaltreu].

---

## 3. Aufbewahrungsfristen

- **180 Tage für Audit und Alerts**  
  Alle sicherheitsrelevanten Events (z. B. Stempel, Redeem, Device-Registrierung) werden für 180 Tage gespeichert.  
  Danach erfolgt automatische Löschung gemäß [Retention Policy].

---

## 4. Consent-Hinweis

- **Kein Banner für Kernfunktion erforderlich**  
  Die Kernfunktion (Stempeln, Prämie einlösen) basiert auf berechtigtem Interesse und benötigt keine Einwilligung.  
  Ein optionaler Hinweistext wird in der PWA angezeigt, aber kein Cookie-Banner.

_Quelle: [DOC:LEGAL], [DPIA Lokaltreu], [EDPB Guidelines]_

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

## UX Prototyping & frühes UAT (Schritt 12)
Alle Prototyping-Aktivitäten halten sich an DSGVO/Art. 11: keine PII, nur Testdaten, Aufzeichnung in EU. Weitere Hinweise in [docs/ux/step-12/README.md](./ux/step-12/README.md) sowie den Entscheidungs-Notizen [UX-Decisions-Schema-Impact](./ux/step-12/UX-Decisions-Schema-Impact.md) für Compliance-Folgenabschätzungen.
