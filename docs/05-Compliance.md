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
