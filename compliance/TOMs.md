# Technische und organisatorische Maßnahmen (TOMs)

Version: 0.9 (Draft) • Owner: Audit-Officer • Referenzen: [docs/lokaltreu-spec.md](../docs/lokaltreu-spec.md), [docs/04-Security-and-Abuse.md](../docs/04-Security-and-Abuse.md), [docs/infra/providers-eu.md](../docs/infra/providers-eu.md)

## Scope
- Schutzmaßnahmen für Vertraulichkeit, Integrität, Verfügbarkeit und Nachvollziehbarkeit des Lokaltreu-SaaS.
- Abgleich mit den eingesetzten EU-Providern (Fly.io, Neon, Upstash, Cloudflare R2/CDN, Mailjet) inkl. DPA-Status und Aufbewahrungsvorgaben.

## 1. Zugriff & Identitäten
- **Admin-Portal**: JWT Access ≤ 15 Min., Refresh ≤ 30 Tage, MFA für Betriebszugänge. Device-Proof (Ed25519) für Mitarbeitergeräte.
- **Secrets**: Verwaltet via SOPS/age; Terraform-State in EU (Cloudflare R2). Kein Klartext im Repo.
- **Least Privilege**: Rollen für Operators (Infra, Audits, Support) mit getrennten Accounts pro Environment (dev/stage/prod).

## 2. Infrastruktur & Provider

| Provider | Region | Maßnahme |
| --- | --- | --- |
| Fly.io | `eu-central` Multi-AZ | Private Apps/Worker, TLS 1.2+, Deployment via GitHub Actions mit SOPS-Secrets. Runtime-Logs ≤ 30 Tage, sicherheitsrelevante Events zusätzlich ins WORM-Audit (Neon/R2). |
| Neon PostgreSQL | EU Cluster (Frankfurt/Amsterdam) | Row-Level-Security, regelmäßige Backups, Audit/WORM-Tabellen, Restriktion auf EU-Kontrolle. Data Retention: Kundendaten bis Kündigung + 30 Tage, Audit 180 Tage. |
| Upstash Redis | EU | Anti-Replay (SETNX), TTL ≤ 60 s (Tokens) / 24 h (Locks). Account-Access via API-Key; Audit-Events nach Neon/R2. |
| Cloudflare R2 & Regional Services | EU Jurisdiction | R2-Buckets im WORM-Modus (180 Tage Audit, 12 Monate Reporting), CDN/DNS nur EU Edge, HSTS, TLS ≥ 1.2. Terraform-State + Backups ausschließlich in R2. |
| Mailjet (Fallback Brevo) | EU | API-Zugriff via Key/Secret, SPF/DKIM, DMARC. Provider-eigene Retention ≤ 30 Tage, Alerts zusätzlich im Audit-Log (180 Tage). |

Alle Provider verfügen über DPAs laut [docs/infra/providers-eu.md](../docs/infra/providers-eu.md). Änderungen lösen Review von AVV/ROPA/DPIA aus.

### Provider-spezifische EU-Datenhaltung
- **Fly.io / Render**: Deployments binden an `region = "fra"` (`eu-central"`). Traffic wird ausschließlich über EU-Edges terminiert; TLS-Zertifikate werden via Let's Encrypt erneuert und private Services nutzen WireGuard Peering. Zugriff auf Fly-Org erfolgt per SSO + MFA.
- **Neon**: Projekte werden nur auf EU-Cluster erstellt (`aws.eu-central-1`/`gcp.europe-west4`). Logische Backups bleiben im selben Cluster; Daten liegen auf verschlüsselten Volumes (AES-256). Zugriff via Service Accounts mit IP-Allowlist (CI, Operators).
- **Upstash**: Instances werden explizit mit `region = "eu"` erzeugt. API-Key-Scope ist auf das Lokaltreu-Projekt limitiert; TLS enforced, Keys in SOPS verwaltet. TTL-Einstellungen begrenzen Datenhaltung auf Sekunden/24 h.
- **Cloudflare R2/CDN**: Buckets nutzen `jurisdiction = "eu"` und Object Lock (WORM) für Audits. CDN setzt Regional Services (EU Edge) + Zero-Trust Policies (mTLS/Access) für Admin Interfaces. DNS-Zonen mit DNSSEC, Zugriff via scoped API Token.
- **Mailjet/Brevo**: Accounts mit EU-Datenhaltung vertraglich zugesichert; API-Key/Secret liegen verschlüsselt (SOPS). Versanddomänen signiert (SPF/DKIM); Webhooks deaktiviert, sodass keine Daten außerhalb EU repliziert werden. Zugriff auf Provider-UI nur über Unternehmens-SSO.

## 3. Logging, Audit & Aufbewahrung
- **WORM-Audit**: Ereignisse (`device.register`, `stamp.claimed`, `reward.redeemed`, `referral.*`, Critical Admin Actions) werden in Neon-WORM-Tabellen geschrieben und täglich signiert nach Cloudflare R2 exportiert. Retention: 180 Tage, danach automatisierte Löschung + Protokoll.
- **Observability**: OTel Collector auf Fly.io (EU). Metriken und Traces bleiben ≤ 90 Tage, enthalten nur pseudonyme IDs (Tenant, Device, Card).
- **Backups/Restore**: Neon Backups (EU) + R2 Snapshots. Nach Restore zwingender Tombstone-Replay (`deleted_subjects`) zur Wahrung von DSR-Löschungen.

## 4. Prozesse & Monitoring
- **Plan-Limits & Abuse**: Rate-Limits (Tenant/IP/Card/Device), Monitoring `rate_token_reuse`, `429_rate`. Planwarnungen bei 80 %/100 %, Alerts via Mailjet (auch als Audit-Event).
- **Incident Response**: Runbooks (`Incident-Breach.md`, `Replay-Suspected.md`, `Restore.md`, `JWKS-Rotation.md`) referenziert in AGENTS. Break-Glass streng kontrolliert (Audit-Eintrag + Follow-up).
- **Testing & Compliance**: CI-Gates prüfen Lint/Tests/Coverage, contract-sync, Anti-Replay, Terraform fmt/validate (EU-Region enforced), GDPR-Checks (Art. 11, Retention 180 Tage).

## 5. Aktualisierung & Reviews
- Quartalsweise Review durch Audit-Officer + Tech Lead.
- Providerwechsel oder neue Subprozessoren werden vor Nutzung in AVV/ROPA/DPIA/TOMs eingetragen.
- Nachweise aus Lasttests, Pen-Tests und Restore-Übungen werden in `docs/evidence/` bzw. Cloudflare R2 abgelegt (180 Tage) und sind auditierbar ohne PII.
