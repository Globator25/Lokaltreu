# ADR 0001 – Monorepo + TypeScript Everywhere

## Context
Lokaltreu betreibt einen modularen Monolithen auf EU-PaaS mit Next.js als PWA-Frontend, einer Node.js-API, PostgreSQL sowie Redis. Die Domänen teilen sich Datenmodelle und Integrationen (Ed25519 Device-Proof, Anti-Replay, WORM-Audit), wodurch inkonsistente Toolchains und verstreute Repos die Einhaltung der CI-/Security-Gates erschweren.

## Decision
Wir bündeln alle Komponenten in einem gemeinsamen Monorepo mit Workspaces für `apps/web`, `apps/api`, `packages/types`, `infra/terraform` und `docs/ADR`. Sämtlicher produktiver und infrastruktureller Code nutzt TypeScript; Turborepo orchestriert Lint, Test, Build und Deploy-Pipelines, damit Next.js, Node-API und Infrastruktur denselben Tooling-Stack teilen.

## Consequences
- Gemeinsame Typdefinitionen (`@lokaltreu/types`) werden direkt aus dem OpenAPI-SPEC generiert und ohne Repo-Grenzen konsumiert.
- Eine zentrale Tooling-Pipeline (TSConfig, ESLint, Prettier, Vitest, Turbo) reduziert Drift und erleichtert CI-Gates, Paralleltests und Audits.
- Build- und Compliance-Artefakte sind konsolidiert, wodurch Coverage, Schema-Checks, WORM-Logs und GDPR-Nachweise einfacher nachweisbar und signierbar sind.
