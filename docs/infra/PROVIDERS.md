# Providers (EU)
Quelle: SPEC/ARCH/ROADMAP. Verarbeitung ausschließlich EU.

## Fly.io (App-Hosting)
Region: eu-central (Multi-AZ vorgesehen). Einsatz: API-Monolith, Worker. Blue-Green/Canary vorbereitet.
Kernpfade: /stamps/claim, /rewards/redeem
Nachweis: App(s) angelegt, EU-Region protokolliert.

## Neon (PostgreSQL)
Region: EU. Branching für stage/dev (Previews). Kernobjekte: Tenants, Campaigns, Stamps, Rewards, Referrals, PlanCounter.
Constraints: eine aktive Kampagne je Mandant.

## Upstash (Redis)
Region: EU. Nutzung: Anti-Replay SETNX(jti), Idempotenz-Locks, Rate-Limits, kleine Queues.

## Cloudflare R2 (EU-Jurisdiction) + CDN Regional Services
R2 Buckets: audit/, reports/. WORM-Exports signiert, 180 Tage.
CDN: Regional Services aktiv (EU-TLS). PWA-Delivery, Static/Images.

## Mail (Mailjet oder Brevo)
EU-Datenhaltung, DPA referenziert.
Zwecke: Sicherheits-Alerts, Plan-Warnungen (80 %), Admin-Einladungen.
**Terraform Status (dev):**
- Variablen deklariert (variables.tf), Mail-Provider validiert.
- Secrets via SOPS (AGE) verschlüsselt, JIT-Decrypt für Plan.

**DoD:** EU-Regionen aktiv, SOPS/AGE produktiv, Plan grün, DPA/Mail EU referenziert.

**Status:** EU-Regionen aktiv, SOPS/AGE produktiv, Plan grün.
