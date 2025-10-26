# Lokaltreu

Modularer Monolith für QR‑Treueprogramme. Betrieb ausschließlich in EU‑Regionen auf PaaS, CDN mit „Regional Services“. Deployments: Blue‑Green / Canary. Environments: **dev**, **stage**, **prod**.

> Beiträge willkommen – siehe **[CONTRIBUTING.md](CONTRIBUTING.md)**.

![ci](https://github.com/Globator25/Lokaltreu/actions/workflows/ci.yml/badge.svg)
![smoke](https://github.com/Globator25/Lokaltreu/actions/workflows/smoke.yml/badge.svg)
![obs-verify-nightly](https://github.com/Globator25/Lokaltreu/actions/workflows/obs-verify-nightly.yml/badge.svg)

## Inhalt
- Betriebsrahmen
- Anforderungen (NFR & SLO)
- Sicherheits- & Compliance-Rahmen
- Technologie-Stack (MVP)
- Projektstruktur
- API-Contract
- CI/CD-Gates
- Quickstart
- Compliance-Artefakte (Ausschnitt)
- [Contributing](#contributing)

## Betriebsrahmen
- Plattformen (EU): PaaS (z. B. Fly.io), CDN: Cloudflare Regional Services, Object‑Storage: Cloudflare R2 (EU‑Jurisdiction), Datenbank: Neon (EU), Cache: Upstash Redis (EU), Mail: Mailjet oder Brevo (EU).
- Kernrouten: `/stamps/claim`, `/rewards/redeem`. Unveränderliches Audit (WORM) mit signierten Exporten.

## NFR & SLO
- Performance je Route: **p50 ≤ 500 ms**, **p95 ≤ 3000 ms**, **p99 ≤ 6000 ms**.
- Verfügbarkeit Kernrouten: **99,90 %**.
- Resilienz: **RPO 15 min**, **RTO 60 min**.

## Sicherheits- & Compliance-Rahmen
- Rechtsgrundlage Betrieb/Automatisierung: **Art. 6 Abs. 1 lit. f DSGVO**.
- Logs können personenbezogene Daten enthalten. Aufbewahrung Audit/Alerts: **180 Tage**; signierte Exporte werden in R2 abgelegt.
- DSR nach **Art. 11 DSGVO** ohne zusätzliche Identifizierung.
- Datensparsamkeit: Endkunden pseudonym, Card-IDs pseudonymisiert.
- Kein Consent-Banner für Kernfunktionen.

## Technologie-Stack (MVP)
- Frontend: **Next.js + React + TypeScript + Tailwind** (PWA-first).
- Backend: **Node.js + TypeScript**, REST/JSON, **OpenAPI 3.1**, Fehlerformat **application/problem+json** (RFC 7807).
- Datenbank: **PostgreSQL (Neon EU)**.
- Cache/Queues: **Redis (Upstash EU)** für Anti‑Replay (SETNX jti), Idempotenz‑Locks, Rate‑Limits.
- Hosting: **Fly.io (EU)**.
- Storage/CDN: **Cloudflare R2 + Regional Services**.
- Mail: **Mailjet/Brevo (EU)**.
- Observability: **OpenTelemetry** → Metriken p50/p95/p99, 5xx‑Rate, 429‑Rate; Dashboards und Alerts.

## Projektstruktur (Monorepo)
```
apps/
  api/    # API, OpenAPI, Tests
  web/    # Next.js PWA
docs/     # CI/CD-Gates, Compliance, Runbooks
infra/    # Terraform + SOPS
.github/  # Workflows (ci.yml, deploy.yml)
```

## API-Contract
- Bündel: [apps/api/openapi/lokaltreu-openapi-v2.0.yaml](apps/api/openapi/lokaltreu-openapi-v2.0.yaml)
- Prinzipien: REST/JSON, Präfix `/v1`, Fehlerformat **application/problem+json** (RFC 7807), Idempotency-Key, Admin-JWT (Access ≤ 15 min, Refresh ≤ 30 d), Geräte-Schlüssel (Ed25519) mit `X-Device-Proof`.
- QR-Token: `jti` + TTL = 60 s, Anti-Replay via Redis `SETNX`.

## CI/CD-Gates
- **.github/workflows/ci.yml**: Lint, Build, Tests inkl. Contract-Tests, **Coverage ≥ 80 %**, OpenAPI-Lint "pass", Artefakte `dist` und `coverage`.
- **.github/workflows/deploy.yml**: manuelles `workflow_dispatch` mit `env={dev,stage,prod}`. Environments geschützt. Deploys nur in EU-Regionen.
- **[docs/CI-Gates.md](docs/CI-Gates.md)**: Kriterien und Links zu Berichten aus dem Pipeline-Run.

## Deploy & Rollback

### Via GitHub Actions (empfohlen)

- **Deployment**: Navigiere zu Actions → deploy und starte den Workflow für die gewünschte Umgebung.
- **Rollback**: Navigiere zu Actions → rollback und gib die vollständige Image-Referenz des stabilen Deployments an (z.B. `registry.fly.io/lokaltreu-dev:deployment-12345`).
- **Smoke Test**: Führe den smoke-Workflow aus, um die Erreichbarkeit der Live-Anwendung zu prüfen.

### Lokales Deployment (für Entwicklung)

```bash
flyctl deploy -a lokaltreu-dev --config fly.dev.toml --local-only
```

## Quickstart
```bash
npm ci
npm run build --workspaces
# oder selektiv:
npm run build -w apps/web
npm test --workspaces -- --coverage
# optional: OpenAPI-Lint
npx @redocly/cli lint apps/api/openapi/lokaltreu-openapi-v2.0.yaml
```

## OpenTelemetry (OTLP) Setup
- Windows (PowerShell): `scripts/set-otel-env.ps1`
  - Session: `./scripts/set-otel-env.ps1`
  - Persist (User): `./scripts/set-otel-env.ps1 -Persist`
  - Persist (Machine/Admin): `./scripts/set-otel-env.ps1 -Persist -Scope Machine`
- Linux/macOS (bash/zsh): `scripts/set-otel-env.sh`
  - Session: `source scripts/set-otel-env.sh`
  - Persist: `scripts/set-otel-env.sh --persist` (fügt einen verwalteten Block in dein rc-File)
  - Entfernen: `scripts/set-otel-env.sh --remove --persist`
  - Hinweis: Das Bash-Skript ist optional/„Legacy“; unter Windows bevorzugt PowerShell verwenden.


## Compliance-Artefakte (Ausschnitt)

* [docs/CI-Gates.md](docs/CI-Gates.md)
* [docs/runbooks/](docs/runbooks/) (Rollback / Restore / Incident)
* `compliance/AVV.md`
* `compliance/TOMs.md`
* `compliance/RoPA.md`
* `compliance/DPIA.md`
* `compliance/Infos-DE.md`

> Hinweis: Keine Secrets im Repo. `.env*` und Terraform-States sind in `.gitignore`. SOPS-verschlüsselte Dateien dürfen versioniert werden.


## Betriebsziele (SLO/Resilienz)
- Verfügbarkeit Kernrouten: 99,90 %
- Performance: p50 ≤ 500 ms, p95 ≤ 3000 ms, p99 ≤ 6000 ms
- Resilienz: RPO 15 min, RTO 60 min

## Contributing

Bitte lies **[CONTRIBUTING.md](CONTRIBUTING.md)**, bevor du PRs erstellst.
Kurzfassung:

```bash
git config core.hooksPath .githooks
# Unix
chmod +x .githooks/pre-commit
```

Lokal prüfen:

```powershell
pwsh -NoProfile -File scripts/verify-bom-and-uid.ps1
```
