# Data Protection Impact Assessment (DPIA)

Version: 0.9 (Draft) • Owner: Audit-Officer • Letzte Prüfung: 2025-12-01 • Scope: Lokaltreu MVP (Admin-Portal, Mitarbeiter-UI, Endkunden-PWA, Referral, DSR)

## 1. Kontext & Trigger

- Verarbeitung umfasst personenbezogene Admin-Daten, pseudonyme Endkunden-IDs und Gerätebindung → potentiell erhöhtes Risiko gemäß Art. 35 DSGVO.
- Keine Profiling- oder Scoring-Funktion, dennoch Angriffspunkte (Device-Proof, Referral-Boni, Audit-Logs).
- Normative Basis: [lokaltreu-spec.md](../docs/lokaltreu-spec.md), [lokaltreu-roadmap.md](../docs/lokaltreu-roadmap.md), [docs/04-Security-and-Abuse.md](../docs/04-Security-and-Abuse.md), [docs/infra/providers-eu.md](../docs/infra/providers-eu.md).
  (Provider-Übersicht siehe auch [docs/infra/01-providers.md](../docs/infra/01-providers.md).)

## 2. Beschreibung der Verarbeitung & Datenflüsse

1. **Admin-Onboarding:** Registrierung (<5 Min.), Kampagne anlegen (US-1). Datenfluss Browser → Fly.io API → Neon Postgres. Bestätigungs-Mail via Mailjet.
2. **Geräteautorisierung:** Admin erzeugt Link (TTL 15 Min.), Mitarbeiter bestätigt am Zielgerät. Device-Public-Key gespeichert, Alert-Mail gesendet.
3. **Loyalty-Transaktionen:** Mitarbeiter erzeugt QR-Token, Endkunde scannt, Anti-Replay via Upstash, Stempel/Rewards in Neon, Audit exportiert nach Cloudflare R2.
4. **Referral (Pläne Plus/Premium):** Referral-Link generieren, Bonus-Stempel nach erstem Stempel. Starter-Pläne blockiert (403 PLAN_NOT_ALLOWED).
5. **Observability & DSR:** SLO-/FinOps-Metriken, WORM-Audit, Self-Service-DSR (Art. 11) mit Tombstone-Liste (`deleted_subjects`) bei Restore.

Alle Provider liegen gemäß [docs/infra/providers-eu.md](../docs/infra/providers-eu.md) in EU-Regionen; siehe [ROPA](ROPA.md) für Details.

### 2.1 Provider & Aufbewahrung

| Provider | Region | Zweck | DPA / Referenz | Aufbewahrung |
| --- | --- | --- | --- | --- |
| Fly.io | `eu-central` | Hosting API/Worker/Status-Page (`lokaltreu-api-dev` u. a.) | DPA aktiv laut Providerliste | Runtime-Logs ≤ 30 Tage, sicherheitsrelevante Events zusätzlich im WORM-Audit (Neon/R2) 180 Tage |
| Neon PostgreSQL | EU Cluster Frankfurt/Amsterdam | Mandanten-, Kampagnen-, Device-, Auditdaten (z. B. DB `lokaltreu_dev`) | DPA aktiv | Produktive Daten bis Löschung + 30 Tage; Audit-WORM 180 Tage (Export R2) |
| Upstash Redis | EU | Anti-Replay, Idempotenz-Locks, Rate-Limits | DPA aktiv | Tokens/Lexical Daten ≤ 24 h; Audit-Ergebnisse werden nach Neon/R2 repliziert |
| Cloudflare R2 / Regional Services | EU Jurisdiction / EU Edge | WORM-Audit, Reporting, Terraform-State, CDN/DNS | DPA aktiv (Regional Services) | R2 Audit 180 Tage; Reporting ≤ 12 Monate; CDN/DNS Logs ≤ 30 Tage |
| Mailjet (Fallback Brevo) | EU | Transaktionale E-Mails (Security Alerts, Plan-Warnungen) | DPA aktiv | Provider-Logs ≤ 30 Tage, Alerts zusätzlich als Audit-Event 180 Tage |

Backups (Neon logical backups, Terraform-State, Reporting-Snapshots) und WORM-Audit-Exporte liegen ausschließlich in Cloudflare R2 (EU Jurisdiction) mit Object-Lock (siehe Provider-Matrix). Restore-Prozesse spielen anschließend die `deleted_subjects`-Tombstone-Liste erneut ein, um DSR-Löschungen auf Anwendungsebene zu respektieren.

## 3. Risikoanalyse

| # | Szenario | Risiko/Bedrohung | Auswirkung | Eintrittswahrscheinlichkeit | Maßnahmen (implementiert) | Restrisiko |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Kompromittiertes Admin-Konto | Unberechtigter Zugriff auf Tenant-Daten, Planwechsel, Geräte | Hoch | Mittel | JWT ≤15 Min., Refresh ≤30 Tage, Device-Mail-Alerts, Audit `admin.login`, MFA für Operatoren | Niedrig |
| R2 | Missbrauch Geräte-Registrierungslink | Fremdes Gerät erhält Zugriff, kann Stempel vergeben | Mittel | Niedrig | TTL 15 Min., Einmaligkeit (invalidate on confirm), UI zeigt Tenantname, Security-E-Mail an Admin, Runbook `Replay-Suspected.md` | Sehr niedrig |
| R3 | QR-Token Replay / Idempotenzbruch | Mehrfache Stempel / Rewards, Fraud | Hoch | Mittel | Upstash `SETNX(jti)` + TTL 60 s, Idempotency-Key Scope {tenant, route, body}, Rate-Limits (Tenant/IP/Card/Device), Audit-Trail `stamp.claimed` | Niedrig |
| R4 | Referral-Abuse / Self-Referral | Unfaire Bonus-Stempel, Planverletzung | Mittel | Niedrig | Backend-Plan-Gates, Self-Referral-Check, Velocity-Limit (5 qualifizierte Referrals/Monat), Audit `referral.*`, Soft-Limits 80 % Warnung | Sehr niedrig |
| R5 | Logs/Bakups mit PII | Wiederauftauchen gelöschter Daten nach Restore; DSGVO-Verstoß | Hoch | Niedrig | Pseudonymisierung (Card-/Tenant-ID, Device-ID), `deleted_subjects` Tombstones, Restore-Runbook + Tests (Roadmap Schritt 48), R2 EU-only, 180 Tage Retention | Niedrig |
| R6 | Device-Proof kompromittiert | Redeem-Endpunkt missbraucht | Hoch | Niedrig | Ed25519 Device-Proof (signed method/path/ts/jti), Device-Sperre 1 Klick, Rate-Limit /rewards/redeem 10 rpm/Device, WORM-Audit `reward.redeemed` | Niedrig |

Bewertungsskala: Hoch / Mittel / Niedrig. Restrisiko akzeptabel solange CI-Gates (Anti-Replay, Device-Proof, GDPR) grün sind (siehe [AGENTS.md](../AGENTS.md)).

## 4. Maßnahmenplan & Follow-ups

1. **Testabdeckung & Contracts** – Coverage ≥ 80 %, contract-sync-frontend required (Roadmap Schritt 37). Owner: Test-Pilot.
2. **Plan-/Referral-Gate Nachweise** – Starter → 403 PLAN_NOT_ALLOWED, Plus/Premium OK, Downgrade Auto-Disable (Docs + Tests). Owner: Contract-Sheriff.
3. **Restore + Tombstone Drill** – jährlicher Test belegt Art.-17-Compliance nach Restore. Owner: Infra-Engineer.
4. **Penetration Test (Roadmap Schritt 44)** – OWASP ZAP + manuelle Device-Proof/Rate-Limit-Checks. Findings → Security backlog. Owner: Security-Engineer.
5. **Provider-Review** – Jede Änderung an [docs/infra/providers-eu.md](../docs/infra/providers-eu.md) löst Review dieser DPIA, des [AVV](AVV.md) und [ROPA](ROPA.md) aus.

## 5. Schlussfolgerung

- Restrisiko insgesamt **niedrig**, da technische und organisatorische Maßnahmen implementiert und CI-Gates überwacht werden.
- Keine zusätzliche Einwilligung notwendig; Rechtsgrundlagen Art. 6(1)(b) und 6(1)(f) reichen aus.
- Review-Zyklus: halbjährlich oder bei neuen Features (z. B. zusätzliche Datenkategorien, neue Provider) sowie nach jedem Sicherheitsvorfall.

## 6. Referenzen & Link-Check

- [AVV.md](AVV.md)
- [ROPA.md](ROPA.md)
- [docs/infra/providers-eu.md](../docs/infra/providers-eu.md)
- [docs/runbooks/](../docs/runbooks/)
- [docs/lokaltreu-roadmap.md](../docs/lokaltreu-roadmap.md) – Schritte 41–48

Links via Markdown-Preview + `rg -n "providers-eu"` geprüft; keine Broken Links oder Inkonsistenzen (Stand 2025-12-01).
