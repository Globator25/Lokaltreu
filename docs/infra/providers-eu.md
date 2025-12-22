# EU-Provider- und Hosting-Matrix (EU-only)

Stand: 2025-12-01 • Owner: Infra-Engineer • Quellen: [lokaltreu-spec](../lokaltreu-spec.md), [lokaltreu-roadmap](../lokaltreu-roadmap.md), [lokaltreu-agents-goldstandard](../lokaltreu-agents-goldstandard.md), [AGENTS](../AGENTS.md)

## Leitplanken

- Alle produktiven Daten, Logs und Backups bleiben in EU-Rechenzentren (vgl. `docs/05-Compliance.md` und Terraform-Gates in `docs/CI-Gates.md`).
- Provider müssen eine AVV/DPA mit EU-Datenhaltung bieten; Einsatz wird zusätzlich im [ROPA](../../compliance/ROPA.md) und in der [DPIA](../../compliance/DPIA.md) dokumentiert.
- Terraform definiert jede Region explizit als EU (`infra/terraform/providers.tf`, `infra/terraform/main.tf`). Änderungen am Provider-Set erfordern Updates in diesem Dokument **und** in allen Compliance-Artefakten.

## Provider-Matrix

| Domäne | Provider & Region | Workloads / Daten | Compliance & Verträge |
| --- | --- | --- | --- |
| App Hosting / Worker | Fly.io `eu-central` (primär), optional Render.com EU als Backup | API-Monolith, Worker, Cron-Flows; TLS-Termination, Blue/Green Deployments | DPA abgeschlossen, Audit-Logs lokal gespiegelt; Härtung nach `docs/04-Security-and-Abuse.md` |
| Datenbank | Neon PostgreSQL (Cluster EU-Frankfurt/Amsterdam) | Multi-Tenant-Datenmodell inkl. Campaigns, Stamps, Rewards, Referral, AuditLog, PlanCounter | EU-Storage garantiert, Branching für dev/stage, Row-Level-Audit (WORM-Anforderung) |
| Redis / Rate-Limits | Upstash Redis (EU) | Anti-Replay (`SETNX(jti)`), Idempotency-Locks, Rate-Limits, kleine Queues | Multi-AZ innerhalb EU; kein Re-Export in Nicht-EU-Regionen |
| Object Storage | Cloudflare R2 (Jurisdiction EU) | WORM-Audit-Exports, Reporting-Dumps, Backups, Assets, Tombstone-Listen | Lifecycle 180 Tage, Zugriff nur via SOPS-Verbindungen; Export-Hashes für Audit-Officer |
| CDN + DNS + DDoS | Cloudflare Regional Services + DNS | PWA-Assets, QR-Grafiken, Public Assets, DNS-Zone | Regional Services erzwingen EU Edge; HSTS, TLS ≥ 1.2, Custom Nameservers dokumentiert in `docs/infra/DNS-CDN.md` |
| Transaktionale E-Mails | Mailjet (primär) / Brevo (Fallback), beide EU | Security Alerts (Gerätebindung), Plan-Warnungen 80/100 %, Admin-Einladungen | DPAs abgelegt, SMTP-Creds verwaltet über SOPS; SPF/DKIM-Einträge gepflegt |
| Status-Page | Eigenes Fly.io-Microservice (separate App in `eu-central`) oder EU-Anbieter getstatuspage | Öffentliche Status-Komponenten (API, Admin, PWA) inkl. Incident-Templates | Muss unabhängig vom Haupt-Cluster laufen; Incident-Runbooks referenziert |

> Hinweis: Für Observability werden ausschließlich EU-Endpoints der jeweiligen Provider genutzt (OTel-Collector auf Fly.io, Export in R2). Kein Versand personenbezogener Daten in Third-Party-Logdienste außerhalb der EU.

## Synchronisation mit Compliance-Dokumenten

- **AVV** (`../../compliance/AVV.md`): Listet oben genannte Subprozessoren samt Vertragsstatus, verweist zurück auf dieses Dokument.
- **ROPA** (`../../compliance/ROPA.md`): Jede Verarbeitungstätigkeit erwähnt explizit die beteiligten Provider (DB, Hosting, Cache etc.).
- **DPIA** (`../../compliance/DPIA.md`): Risiko-Bewertungen berücksichtigen die technischen Kontrollen je Provider (z. B. Redis TTL, Cloudflare EU-Scope, R2 WORM).
- **Retention/Backups** (`../../compliance/Retention-Policy.md`): Erbt Speicher- und Löschfristen aus R2/Neon, plus Tombstone-Anwendung nach Restore (vgl. Roadmap Schritt 48).

## Qualitäts- und Link-Checks

- Terraform-Basisdateien (`infra/terraform/providers.tf`, `infra/terraform/backend.tf`, `infra/terraform/main.tf`) verweisen nur auf oben aufgeführte Provider.
- Relative Links in diesem Dokument wurden geprüft (VSCode markdown-preview & `rg -n "providers-eu"`). Keine toten Links gefunden.
- Änderungspfad: Anpassungen an Provider-Setup benötigen Pull-Request mit Audit-Officer-Review (siehe `AGENTS.md` Abschnitt „ZENTRALE PR-CHECKLISTE“).
