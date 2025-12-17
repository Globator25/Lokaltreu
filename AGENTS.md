# AGENTS – Governance

- Sentinel present
- Arbeitssprache für alle Agenten: **Deutsch** für Fach- und Governance-Kontext, **Englisch** für Code, API-Objekte und Fehlermeldungen.

## 0. Kontext & Wissensquellen

Dieses Repository enthält das SaaS-Produkt **Lokaltreu** – eine digitale Stempelkarte für lokale Kleinstunternehmen (z. B. Friseure, Kosmetik-, Nagelstudios).

Die maßgeblichen Wissensquellen (Single Source of Truth) sind:

**Produkt & Domäne**

- `docs/01-Project-Canvas.md` – Projekt-Canvas, Zielgruppe, Value Proposition.
- `docs/02-Processes.md` – Kernprozesse, User-Flows, Onboarding.
- `docs/lokaltreu-spec.md` – konsolidierte Produkt- und Technik-Spezifikation.

**Qualität & Nichtfunktionale Anforderungen**

- `docs/03-NFRs.md` – Performance, Verfügbarkeit, Skalierung, Resilienz.
- `docs/04-Security-and-Abuse.md` – Security, Abuse-Cases, Anti-Replay, Abuse-Prevention.
- `docs/05-Compliance.md` – DSGVO, Datensparsamkeit, Aufbewahrung & Löschkonzepte.
- `docs/lokaltreu-agents-goldstandard.md` – Gold-Standard-Governance und Rollenbeschreibung.

**Roadmap, Gates & Betrieb**

- `docs/lokaltreu-roadmap.md` – Gesamt-Roadmap (2.3.1) inkl. MVP-Umfang & Go-Live-Kriterien.
- `docs/CI-Gates.md` – Definition der CI-/Qualitäts-Gates (Lint, Tests, Coverage, schema_drift, GDPR, Security).
- `docs/runbooks/` – Betriebs- und Incident-Runbooks.
- `docs/infra/`, `docs/observability/` – Infrastruktur- und Observability-Richtlinien.

Alle Agents, Tools und KI-Helfer (inkl. Codex) sollen diese Dokumente als Referenz verwenden, wenn sie Code oder Entscheidungen für Lokaltreu unterstützen.

---

## 1. Produktleitplanken (Kurzfassung)

Diese Leitplanken gelten immer:

- **Single-Admin-Design:**  
  Pro Mandant existiert genau ein Administrator (Unternehmensinhaber). Kein komplexes Rollenmodell.

- **Radikale Einfachheit im Frontend:**  
  Mitarbeiter-Oberflächen haben genau zwei Aktionen:  
  1. Stempel vergeben  
  2. Prämie einlösen

- **Privacy by Design:**  
  Endkunden bleiben anonym bzw. pseudonym; keine Speicherung von Klarnamen, E-Mail-Adressen oder Telefonnummern.

- **Security by Default:**  
  Anti-Replay, Idempotenz, WORM-Audit-Logs, Plan-Limits und Device-Proof sind Zielzustand.  
  Vereinfachungen im MVP müssen dokumentiert und später gehärtet werden.

- **PWA-first:**  
  Kern-User-Flows funktionieren im mobilen Browser, ohne App-Store-Installation.

- **EU-Hosting & DSGVO:**  
  Produktive Daten und Logs werden in der EU verarbeitet und gespeichert.  
  Datenminimierung sowie klare Retention- und Löschregeln sind Pflicht.

Weitere Details stehen in:
- `docs/lokaltreu-spec.md`
- `docs/lokaltreu-roadmap.md`
- `docs/lokaltreu-agents-goldstandard.md`
- `docs/03-NFRs.md`, `docs/04-Security-and-Abuse.md`, `docs/05-Compliance.md`

---

## 2. Rollen im Editor

### 2.1 Technischer Product Owner (TPO)

Wenn du als TPO agierst, dann:

- arbeitest du von **User Stories** und **Plan-/Preismodell** her,
- prüfst jede API-/UI-Änderung gegen:
  - die OpenAPI-Spezifikation (SSOT),
  - den MVP-Umfang und die Phasen in `docs/lokaltreu-roadmap.md`,
- sorgst dafür, dass Onboarding des Inhabers < 5 Minuten bleibt,
- verschiebst Nice-to-have-Features konsequent in spätere Phasen, wenn sie das MVP-Risiko erhöhen.

Wenn du als KI im Editor arbeitest und als TPO angesprochen wirst („Handle als Technischer Product Owner für Lokaltreu“), befolge diese Regeln.

### 2.2 Software-Architekt

Wenn du als Architekt agierst, dann:

- prüfst du Implementierungen gegen die Sicherheits- und Architekturprinzipien aus:
  - `docs/lokaltreu-spec.md`
  - `docs/lokaltreu-agents-goldstandard.md`
  - `docs/04-Security-and-Abuse.md`
- achtest insbesondere auf:
  - korrekte Anti-Replay-Logik (TTL, jti, Idempotenz, Redis/Upstash),
  - Device-Proof mit Ed25519 (Key-Management, Signaturprüfung, Zeitfenster),
  - WORM-Audit-Logs (append-only, keine in-place Updates),
  - Plan-/Limit-Mechanismen (Soft-Limits, Warnungen bei 80 % und 100 %).

Wenn du als KI im Editor arbeitest und als Architekt angesprochen wirst („Handle als Software-Architekt für Lokaltreu“), befolge diese Regeln.

---

## 3. Nutzung im Editor (Codex & Co.)

Wenn eine KI oder ein Tool (z. B. Codex) in diesem Repository arbeitet, soll es:

1. **Dieses `AGENTS.md`** als Einstieg lesen und die Leitplanken beherzigen.
2. Bei fachlichen oder architektonischen Fragen zusätzlich mindestens folgende Dateien als Kontext einbeziehen:
   - `AGENTS.md`
   - `docs/lokaltreu-spec.md`
   - `docs/lokaltreu-roadmap.md`
   - `docs/lokaltreu-agents-goldstandard.md`
   - bei Security-/Compliance-Themen: `docs/04-Security-and-Abuse.md`, `docs/05-Compliance.md`, `docs/CI-Gates.md`
3. Keine Features vorschlagen, die:
   - personenbezogene Daten von Endkunden erfassen, die nicht in den Spezifikationen vorgesehen sind,
   - das Single-Admin-Design aufbrechen,
   - die PWA-first-Strategie unterlaufen.

- **Mock & Lint lokal:** `npm run mock:api` startet Prism (Port 4010) gegen das OpenAPI-SSOT; `npm run openapi:lint` prüft das Contract via Spectral.

---

## 4. CI-Gates & Quality

- Die gültigen Gates (Lint, Build, Tests, Coverage ≥ 80 %, schema_drift = 0, GDPR, Security, Terraform EU-only usw.) sind in `docs/CI-Gates.md` beschrieben.
- Änderungen an Gates müssen dort dokumentiert und versioniert werden.
- Bei Unsicherheit zu Qualitätsanforderungen ist **CI-Gates** die maßgebliche Referenz.

---

## 5. Emergency Break-Glass Deployment

_(Break-Glass-Regeln aus deiner bisherigen Version – inhaltlich unverändert, nur als eigener Abschnitt einsortiert.)_

- **Zulässige Gründe**: Nur kritische Security-Lücke oder massiver Incident mit bestätigtem SLO-Bruch; Komfort- oder Feature-Druck zählt nicht.
- **Berechtigte Rollen**: Tech Lead + Audit-Officer (oder Contract-Sheriff) geben eine 2-Faktor-Freigabe und protokollieren diese im Incident-Log.
- **Ablauf**: PR mit `[BREAK-GLASS]` taggen → zwei Maintainer-Reviews → Admin-Merge → Entscheidung + Zeitstempel loggen → Follow-up-Ticket mit Checkliste erstellen.
- **Logging & Ticketing**: Ticket/Log enthalten Commit-SHA, Grund, Laufzeit und geplante Nacharbeiten; Audits müssen Zugriff auf diese Dokumentation haben.
- **Gates wiederherstellen**: Alle übersprungenen Gates (Lint, Build, Tests, Coverage ≥ 80 %, schema_drift = 0, GDPR, Security, Terraform EU-only) unmittelbar nachziehen und im Ticket abhaken; bis dahin kein weiterer Break-Glass.
