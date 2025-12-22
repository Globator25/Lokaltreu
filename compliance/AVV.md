# Auftragsverarbeitungsvertrag (AVV)

Version: 0.9 (Draft) • Owner: Audit-Officer • Scope: Alle Lokaltreu-Mandanten in der EU

## 1. Parteien und Geltungsbereich

- **Verantwortlicher:** Der jeweilige Lokaltreu-Mandant (lokaler Einzelunternehmer, siehe [docs/01-Project-Canvas.md](../docs/01-Project-Canvas.md)).
- **Auftragsverarbeiter:** Lokaltreu Operations (interner Arbeitstitel, juristische Person tbd). Verarbeitung ausschließlich in EU-Regionen; siehe [Provider-Matrix](../docs/infra/providers-eu.md).
- **Laufzeit:** Bindet an die Laufzeit des SaaS-Abonnements; endet automatisch nach vollständiger Löschung und Ablauf der Retention-Fristen (180 Tage Audit-Logs).

## 2. Gegenstand und Zweck der Verarbeitung

| Kategorie | Zweck | Rechtsgrundlage | Systeme |
| --- | --- | --- | --- |
| Mandantenverwaltung | Registrierung, Plan-Management, Rechnungsstellung | Art. 6(1)(b) DSGVO | Fly.io (App), Neon (Postgres) |
| Geräteautorisierung | Sicheres Hinzufügen/Sperren von Mitarbeiter-Geräten | Art. 6(1)(f) DSGVO (Schutz legitimer Interessen) | Fly.io, Upstash, Mailjet |
| Loyalty-Transaktionen | Stempel, Prämien, Referral-Gate | Art. 6(1)(b) DSGVO | Fly.io, Neon, Upstash |
| Audit/Monitoring | Anti-Abuse, Incident Response, DSR-Protokolle | Art. 6(1)(f) DSGVO + Art. 11 DSGVO | Neon (AuditLog), Cloudflare R2, OTel EU |

## 3. Arten von Daten und Betroffenen

- **Administratoren (Mandanteninhaber):** Name, geschäftliche Kontaktadresse, Rechnungsdaten, Login-Metadaten.
- **Mitarbeiter-Geräte:** Geräte-ID, Device-Public-Key (Ed25519), Zeitpunkte der Autorisierung, Status.
- **Endkunden (anonym/pseudonym):** Card-ID (UUID), Stempel- und Prämienstatus, Referral-Code (pseudonym).
- **Meta-/Logdaten:** Tenant-ID, Device-ID, jti, Timestamp, IP (gekürzt), User-Agent, keine Klarnamen.

## 4. Kategorien von Verarbeitungsvorgängen

Die konkrete Verarbeitung ist im [ROPA](ROPA.md) beschrieben; dieses AVV verweist auf die dort versionierten Aktivitäten (ROPA-ID 01–06). Planänderungen oder neue Features (Roadmap > Phase 1) erfordern eine Aktualisierung beider Dokumente.

## 5. Unterauftragsverarbeiter / Subprozessoren (EU-only)

| Dienst | Zweck / Workloads | Region | Kategorien von Daten | DPA / Referenz |
| --- | --- | --- | --- | --- |
| Fly.io (optional Render Frankfurt) | Hosting des Next.js/Node-Monolithen (z. B. `lokaltreu-api-dev`), Worker, Status-Sidecar | `eu-central` Multi-AZ | Mandanten-Metadaten, Deploy-Artefakte, Laufzeit-Logs (ohne PII) | [docs/infra/providers-eu.md](../docs/infra/providers-eu.md) / [docs/infra/01-providers.md](../docs/infra/01-providers.md) |
| Neon (PostgreSQL) | Primäre Multi-Tenant-Datenbank inkl. Audit/WORM (z. B. DB `lokaltreu_dev`) | EU Cluster Frankfurt/Amsterdam | Mandanten-/Kampagnen-/Device-/Stempel-/Auditdaten | Providerliste + Neon DPA (siehe obige Verweise) |
| Upstash Redis | Anti-Replay `SETNX`, Idempotenz-Locks, Rate-Limits | EU Region | Kurzlebige Token-IDs, Device-IDs, jti | Providerliste (Upstash DPA) |
| Cloudflare (R2 + Regional Services CDN/DNS) | WORM-Audit-Exports, Reporting, Assets, Terraform-State, CDN/DNS | EU Jurisdiction (Storage) + EU Edge | Audit-Events (signiert), Reporting-Dumps (pseudonym), statische Assets | Providerliste (Cloudflare DPA, EU Regional Services) |
| Mailjet (Fallback: Brevo) | Transaktionale E-Mails (Security Alerts, Plan-Warnungen, Admin-Einladungen) | EU Datacenter | Versandmetadaten (Tenant, Gerät, Planstatus), keine Endkundendaten | Providerliste (Mailjet/Brevo DPA) |

Aufbewahrung/Retention je Dienst siehe [TOMs.md](TOMs.md) und Abschnitt 7; Audit-Events verbleiben 180 Tage in Neon/R2 (WORM).

Änderungen erfordern vorherige Information des Verantwortlichen sowie Aktualisierung der Providerliste; siehe Eskalationsprozess in Abschnitt 8.

## 6. Technische und organisatorische Maßnahmen (TOMs)

- Referenz auf [TOMs.md](TOMs.md) und [docs/04-Security-and-Abuse.md](../docs/04-Security-and-Abuse.md).
- Anti-Replay/Idempotenz (Redis TTL + SETNX), Device-Proof (Ed25519) und WORM-Audit werden kontinuierlich getestet (CI-Gates).
- Zugriffskontrolle: RBAC nach Least-Privilege, Secrets via SOPS/AGE, Multi-Faktor für Produktionszugriffe.

## 7. Löschung, Retention & Backups

- Standard-Retention: 180 Tage für Audit-/Log-Daten, sofortige Löschung für Tenant-Daten nach Kündigung + 30 Tage Grace.
- Backups werden nicht editiert; stattdessen sorgt die Tombstone-Liste (`deleted_subjects`) für erneute Löschung nach Restore (vgl. [Retention-Policy.md](Retention-Policy.md) und Roadmap Schritt 48).
- Exportierte Audits werden signiert in Cloudflare R2 gespeichert; Zugriff nur für Audit-Officer.

## 8. Weisungsrecht, Eskalation & Audits

- Weisungen erfolgen über das Admin-Portal oder schriftlich über registrierte Support-Kanäle.
- Sicherheits- oder Datenschutzvorfälle folgen den Runbooks in `../docs/runbooks/` (insb. `Incident-Breach.md`, `Replay-Suspected.md`).
- Break-Glass-Prozess siehe [AGENTS.md](../AGENTS.md) Abschnitt 5; Einsatz wird im Audit-Log protokolliert und erfordert Follow-up-Ticket.

## 9. Referenzen & Link-Check

- Infrastrukturabbildung: [docs/infra/providers-eu.md](../docs/infra/providers-eu.md)
- Verarbeitungstätigkeiten: [ROPA.md](ROPA.md)
- Risiko- und Maßnahmenkatalog: [DPIA.md](DPIA.md)
- Rechtliche Grundlagen & Prozesse: [docs/lokaltreu-spec.md](../docs/lokaltreu-spec.md), [docs/lokaltreu-roadmap.md](../docs/lokaltreu-roadmap.md)

Alle obigen Referenzen wurden zuletzt am 2025-12-01 geprüft; keine toten Links festgestellt (`rg -n "providers-eu"`, Markdown-Vorschau).
