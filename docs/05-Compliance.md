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

## 5. Datenstandorte, Secrets & Backups (EU-only)

**Ziel.** Alle produktiven Daten, Secrets und Backups verbleiben in der EU. Keine Nutzung von US/AP/SA/AU-Regionen.

**Provider-Regeln.**
- Fly.io: Primärregion ∈ {ams, cdg, fra, lhr, arn}
- Neon: Projektregion ∈ {aws-eu-central-1, aws-eu-west-2, azure-gwc}
- Upstash Redis: Region ∈ {eu-central-1, eu-west-1, eu-west-2}; URL muss mit `https://eu-` beginnen
- Cloudflare R2: `r2_location_hint` ∈ {weur, eeur}, `r2_jurisdiction` = eu

**Technische Durchsetzung.**
- Terraform-Validation per Regex in `infra/terraform/variables*.tf`
- CI: `terraform fmt -check`, `terraform validate`, und EU-Whitelist-Scan (`scripts/ci-terraform-eu.ps1`)

**Verifikation (Runbook).**
1) Static Code: EU-Scan ausführen, keine Non-EU-Treffer (`us-`, `ap-`, `sa-`, `au-`).
2) Plan/State: `terraform plan` prüfen; danach `terraform state show <resource>` auf Felder `region|location|jurisdiction|url`.
3) Provider-UIs:
   - Fly: Primary Region = EU
   - Neon: Project Region = EU, Backups = EU
   - Upstash: Database Region = EU, URL-Präfix `eu-`
   - Cloudflare R2: Jurisdiction = eu, Location Hint = weur/eeur

**Nachweise (Audit).**
- Artefakte: Plan, State-Auszüge, UI-Screenshots
- PR-Pflicht: Änderungen an Regionen müssen diesen Abschnitt verlinken

_Siehe auch:_ `docs/compliance/EU-REGIONS.md`, `ARCH.md#EU-Datenstandorte-secrets--backups`
