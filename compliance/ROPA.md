# Verzeichnis der Verarbeitungstätigkeiten (ROPA)

Version: 0.9 (Draft) • Owner: Audit-Officer • Letzte Prüfung: 2025-12-01

## Überblick

- **Verantwortlicher:** jeweiliger Lokaltreu-Mandant (Einzelunternehmer).
- **Auftragsverarbeiter:** Lokaltreu Operations (siehe [AVV](AVV.md)).
- **Rechtsgrundlagen:** Art. 6(1)(b) DSGVO (vertragliche Pflichten), Art. 6(1)(f) DSGVO (Security & Abuse-Prevention), Art. 11 DSGVO (DSR ohne Zusatzdaten).
- **Provider:** EU-only laut [docs/infra/providers-eu.md](../docs/infra/providers-eu.md); Änderungen werden in AVV/ROPA/DPIA synchron gepflegt.

## Verarbeitungstätigkeiten

| ID | Tätigkeit | Zweck & Beschreibung | Betroffene / Datenkategorien | Systeme & Subprozessoren | Rechtsgrundlage | Speicher- & Löschfristen |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Mandanten-Onboarding & Planverwaltung | Registrierung, Billing, erste Kampagne (US-1) | Admin: Name, Firma, Rechnungsadresse, Planstatus, JWT/Refresh-Token | Fly.io (App), Neon (Postgres), Mailjet (Onboarding-Mail) | Art. 6(1)(b) | Vertragslaufzeit + 30 Tage; Rechnungsbelege gem. HGB/AO |
| 02 | Geräteautorisierung | Einladung, Bestätigung, Sperren/Löschen (US-2/3) | Mitarbeiter-Gerät: Device-ID, Ed25519-Public-Key, Status, Timestamps | Fly.io, Neon (Device Table), Upstash (Ephemeral Tokens), Mailjet (Security Alert) | Art. 6(1)(f) | Gerät aktiv: bis Entfernung; Audit-Events 180 Tage |
| 03 | Loyalty-Transaktionen | Stempel vergeben, Prämie einlösen, Audit (US-6–9) | Endkund:innen: Card-ID (UUID), Stempel-Count, Reward-Status; Admin ID | Fly.io, Neon (Stamps/Rewards), Upstash (Anti-Replay), Cloudflare CDN (QR), Cloudflare R2 (Audit-Exports) | Art. 6(1)(b) | Programmdauer + 30 Tage; Audit 180 Tage |
| 04 | Referral-Programm (planabhängig) | Referral-Link, Erster-Stempel-Qualifikation, Bonus-Stempel (US-13/14) | Werber & Neukunde: Referral-Code (pseudonym), Zeitstempel | Fly.io, Neon (Referrals), Upstash (Rate-Limits) | Art. 6(1)(b) und Art. 6(1)(f) | Laufzeit + 30 Tage; Audit 180 Tage |
| 05 | Reporting & Observability | KPI-Dashboards, cost_per_tenant, Alerts (US-4, Roadmap Schritt 8/47) | Aggregierte Tenant-/Gerätekennzahlen, Latenzen, Fehlerraten (ohne PII) | Fly.io, Neon (Materialized Views), Cloudflare R2 (Reports), OTel Collector (Fly EU) | Art. 6(1)(f) | Reporting-Rohdaten ≤ 12 Monate, Audit 180 Tage |
| 06 | DSR & Tombstone-Management | Self-Service-Löschungen (Art. 11), Restore+Tombstone nach Roadmap Schritt 48 | Card-ID, Tenant-ID, Tombstone-Hash, DSR-Protokoll | Fly.io, Neon (`deleted_subjects`), Cloudflare R2 (Backups) | Art. 6(1)(c) und Art. 17 | Tombstones dauerhaft; DSR-Logs 3 Jahre |
| 07 | Hosting & Runtime-Betrieb | Betrieb API/Worker/PWA, Blue/Green Deployments, Status-Page | Tenant-/Device-IDs im Log (pseudonym), Deploy-Artefakte | Fly.io (`eu-central`), optional Render Frankfurt | Art. 6(1)(f) (Betrieb + Resilienz) | Runtime-Logs ≤ 30 Tage; kritische Events → WORM 180 Tage |
| 08 | Logging, Audit & Backups | WORM-Audit, Reporting, Terraform-State, Restore-Fähigkeit | Audit-Events, Reporting-Aggregate, Terraform-State (keine PII) | Neon (Audit/WORM), Cloudflare R2 (EU Jurisdiction) | Art. 6(1)(f) / Art. 5(2) DSGVO | Audit 180 Tage (R2); Reporting ≤ 12 Monate; State bis Rotation |
| 09 | Transaktionale Mails | Sicherheitswarnungen, Plan-Limits, Admin-Einladungen | Tenant-/Gerätebezug, Planstatus, keine Endkundendaten | Mailjet (EU) / Brevo Fallback | Art. 6(1)(f) | Provider-Logs ≤ 30 Tage; Audit-Kopie 180 Tage |

## Schutzmaßnahmen

- **Authentisierung:** Admins via JWT (≤15 min), Geräte via Ed25519 Device-Proof; Endkunden ohne Login, rein pseudonyme IDs.
- **Technik:** TLS 1.2+, AES-256-At-Rest (Neon/R2), Redis TTL 60 s, Anti-Replay via `SETNX`.
- **Audit:** WORM-Tabellen, 180 Tage Aufbewahrung, signierte Exporte nach Cloudflare R2 (siehe [TOMs.md](TOMs.md)).
- **Plan-/Referenzkontrollen:** Starter-Plan blockiert Referral (403 PLAN_NOT_ALLOWED), Soft-Limits bei 80/100 % (E-Mail + Banner).

## Übermittlungen an Drittländer

Nicht vorgesehen. Alle Subprozessoren betreiben EU-Rechenzentren; Terraform/CI prüfen EU-Regionen (`docs/CI-Gates.md`), `docs/infra/providers-eu.md` ist die Single Source of Truth.

## Subprozessoren & Aufbewahrung

| Provider | Region | Zweck | DPA / Referenz | Aufbewahrung |
| --- | --- | --- | --- | --- |
| Fly.io | `eu-central` | App-Hosting, Worker, Status-Page | DPA: siehe [docs/infra/providers-eu.md](../docs/infra/providers-eu.md) | Runtime-Logs ≤ 30 Tage, kritische Events zusätzlich im WORM-Audit (Neon/R2) 180 Tage |
| Neon PostgreSQL | EU Cluster Frankfurt/Amsterdam | Produktive Datenbanken inkl. Audit-WORM-Tables | DPA aktiv, Providerliste | Mandantendaten bis Löschung + 30 Tage; Audit-Events 180 Tage, Exporte nach R2 |
| Upstash Redis | EU | Anti-Replay, Idempotenz-Locks, Rate-Limits | DPA aktiv | Ephemere Keys ≤ 24 h; Audit-relevante Ergebnisse werden in Neon/R2 persistiert (180 Tage) |
| Cloudflare R2 + Regional Services | EU Jurisdiction / EU Edge | WORM-Audit-Exports, Reporting, Terraform-State, CDN/DNS | DPA aktiv, EU-only Edge | Audit-WORM 180 Tage, Reporting ≤ 12 Monate, CDN-Logs ≤ 30 Tage |
| Mailjet (Fallback Brevo) | EU | Transaktionale Sicherheits-/Plan-Mails | DPA aktiv | Providerseitige Message-Logs ≤ 30 Tage, Alerts zusätzlich im Audit-Log (180 Tage) |

## Referenzen & Validierung

- Infrastruktur & Provider: [docs/infra/providers-eu.md](../docs/infra/providers-eu.md)
- Sicherheitskonzept: [docs/04-Security-and-Abuse.md](../docs/04-Security-and-Abuse.md)
- Risikoanalyse: [DPIA.md](DPIA.md)
- AV-Vertrag: [AVV.md](AVV.md)
- Roadmap-Bezug: [docs/lokaltreu-roadmap.md](../docs/lokaltreu-roadmap.md) Schritte 2, 13, 23, 48

Markdown-Links geprüft (VSCode Preview, `rg -n "providers-eu"`). Keine toten Links festgestellt; Inkonsistenzen zwischen ROPA/AVV/DPIA wurden bereinigt (Stand 2025-12-01).
