# Provider-Matrix Lokaltreu (EU-only)

Quelle: SPEC, ARCH, Roadmap 2.3.1 sowie `docs/infra/providers-eu.md`. Ziel: zentrale Referenz für Infrastruktur- und Compliance-Entscheidungen (EU-Hosting, DSGVO, FinOps).

| Kategorie | Provider & bevorzugte Region | Zweck/Rolle | Architekturreferenz / Stichworte |
| --- | --- | --- | --- |
| App Hosting (API & PWA) | Fly.io `eu-central` (optional Render Frankfurt als Fallback) | Monolith (Next.js/Node) – dev-App z. B. `lokaltreu-api-dev`, Worker, Status-Sidecar | EU-only, PWA-first, Anti-Replay via Edge TLS, FinOps (Autoscaling) |
| Postgres | Neon (EU Cluster Frankfurt/Amsterdam) | Primäre Mandanten-/Campaign-/Stamp-/Audit-Datenbank inkl. WORM-Tabellen (dev-DB `lokaltreu_dev`) | Single-Admin, eine aktive Kampagne je Mandant, EU-only, Compliance/DSGVO, FinOps Branching |
| Redis / Anti-Replay | Upstash Redis (EU Region) | Anti-Replay `SETNX`, Idempotency-Locks, Rate-Limits, kurze Queues | Security by Default, Device-Proof, Idempotenz, FinOps (serverless pricing) |
| Object Storage | Cloudflare R2 (EU Jurisdiction) | WORM-Audit-Exports (180 Tage), Reporting-Dumps, Assets, Terraform-State | WORM/Retention, Compliance (DPIA/ROPA), EU-only, Cost Control |
| CDN / DNS | Cloudflare CDN mit Regional Services (EU) | PWA-/Asset-Auslieferung, DDoS, DNS, QR-Delivery | PWA-first, EU TTFB, Security (HSTS, TLS ≥1.2), DSGVO |
| Mail (transaktional) | Mailjet (EU Datenhaltung, Brevo als Alternative) | Security Alerts (Geräte), Plan-Warnungen 80/100 %, Admin-Einladungen | Security by Default, Plan-Limits, EU-only Verarbeitung, Compliance (AVV/TOMs) |

Hinweise:
- Alle Provider werden in Terraform (siehe `infra/terraform/`) parametrisiert; CI-Gates erzwingen EU-Regionen.
- Änderungen am Provider-Setup erfordern Updates in AVV/ROPA/DPIA/TOMs/Retention sowie Review durch Audit-Officer.
