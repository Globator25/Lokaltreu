# Providers (EU Only)

Quelle: SPEC/ARCH/ROADMAP. Alle Daten und Logs werden ausschließlich in EU-Regionen verarbeitet. Terraform/CI erzwingen dies (vgl. `docs/CI-Gates.md`).

| Kategorie | Provider | Region | Zweck | Besonderheiten |
| --- | --- | --- | --- | --- |
| App Hosting | Fly.io | `eu-central` (Multi-AZ) | API-Monolith + Worker, Blue-Green/Canary | TLS-Termination EU, Autoscaling, Incident-Logs in EU |
| Datenbank | Neon (PostgreSQL) | EU (Frankfurt/Amsterdam Cluster) | Tenants, Campaigns, Stamps, Rewards, Referrals, PlanCounter | Serverless Branching (dev/stage), Constraint „eine aktive Kampagne je Mandant" |
| Redis / Cache | Upstash | EU | Anti-Replay `SETNX(jti)`, Idempotenz-Locks, Rate-Limits, kleine Queues | Geo-Replica nicht aktiviert (EU only), TLS enforced |
| Object Storage | Cloudflare R2 | EU Jurisdiction | WORM-Audit-Exports, Reports, Medien/Assets | Signierte Exporte, Lifecycle 180 Tage, Zugriff via SOPS-creds |
| CDN / DNS | Cloudflare Regional Services | EU | PWA-Auslieferung, statische Assets, DNS | Regional Services (kein Edge außerhalb EU), HSTS, TLS 1.2+ |
| Mail | Mailjet oder Brevo | EU | Security-Alerts, Plan-Warnungen, Admin-Einladungen | DPA hinterlegt, SPF/DKIM in DNS-CDN-Doku |
| Status-Page | getstatuspage (EU) oder eigener Fly-App Slot | EU | Öffentliche Status-Informationen | Muss unabhängig vom Haupt-Hosting laufen |

## Terraform / Secrets status

- Variablen in `infra/terraform/variables.tf` deklariert; Provider-Regionen auf EU gesetzt.  
- Secrets werden via SOPS (AGE) verwaltet, CI/Dev nutzen JIT-Decrypt.  
- `terraform fmt` / `validate` laufen grün; State-Backends liegen ebenfalls in EU (z. B. Cloudflare R2 Bucket).  
- DoD: EU-Regionen aktiv, SOPS/AGE produktiv, DPAs referenziert.
