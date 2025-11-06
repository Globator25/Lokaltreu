# AGENTS.md — Gold v2.2

status: authoritative
ci-required: true
required-checks:

- ci / build
- ci / openapi-lint-and-codegen
- ci / unit-and-contract
- ci / coverage (>=80%)
- gdpr-compliance / gdpr-checks
- security-gates / anti-replay
- security-gates / device-proof
- security-gates / rfc7807-and-plan-gates
- security-gates / terraform-validate-eu-only
- security-gates / secrets-scan
  policy:
  retention_days: 180
  x-schema-drift-policy: "0"

## Priorität bei Entscheidungen und Implementationen: `SPEC → OpenAPI → ARCH → AGENTS.md → Code`.

## 1. Zweck

Dieses Dokument definiert Rollen, Verantwortlichkeiten, Entscheidungswege und verbindliche Qualitätsregeln für alle Repositories unter dem Lokaltreu-Workspace. Ziel: reproduzierbare Qualität, auditierbare Prozesse, klare Ownership.

## 2. Geltungsbereich

Gültig für:

- alle Apps unter `apps/*`
- alle Packages unter `packages/*`
- Infrastruktur- und Tooling-Repositories (`infra/*`, `.github/**`, `tools/**`)
- ADR- und RFC-Prozesse (`docs/adr/**`)

---

## 3. Rollen

### 3.1 Maintainer

- Endverantwortung für technische Entscheidungen
- Unblocker bei Architektur, Security, Releases
- Gibt Breaking Changes nach Review frei

### 3.2 Reviewer

- Prüfen Code, Tests, Security-Aspekte und API-Kontrakte
- Blockieren PRs bei Nichteinhaltung der Regeln

### 3.3 Security

- Durchsetzt Datenschutz- und Security-Policies
- Erstkontakt bei Vorfällen
- Bewertet Abweichungen und Hotfixes

### 3.4 Release

- Versionierung, Changelogs, Tags
- Stellt sicher, dass alle CI-Gates grün sind

### 3.5 Infra

- CI/CD-Pipelines, Environments, Deployments
- Observability, Metriken, Dashboards

---

## 4. RACI-Matrix

| Aktivität                   | Maintainer | Reviewer | Security | Release | Infra |
| --------------------------- | ---------- | -------- | -------- | ------- | ----- |
| Architekturentscheidung     | A          | C        | C        | I       | I     |
| API-Kontraktänderung        | A          | R        | C        | I       | I     |
| Security-Fix                | A          | C        | R        | I       | I     |
| GDPR-relevante Funktion     | A          | R        | R        | I       | I     |
| Release erstellen           | C          | I        | I        | A       | R     |
| CI/CD-Setup & Infrastruktur | C          | I        | I        | I       | A     |

**A = Accountable, R = Responsible, C = Consulted, I = Informed**

---

## 5. Entscheidungsregeln

### 5.1 Kleine Änderungen

- 1 Reviewer genügt
- Kein ADR notwendig

### 5.2 Breaking Changes oder API-Änderungen

- 2 Reviewer erforderlich
- Schriftliches ADR obligatorisch
- OpenAPI-Lint & Type-Diff müssen im CI bestehen

### 5.3 Security- oder Datenschutz-Hotfix

- Maintainer + Security entscheiden gemeinsam
- ADR/Dokumentation innerhalb von 24 h nachreichen
- Notfall-Release zulässig

---

## 6. Arbeitsabläufe

### 6.1 Pull Requests

- Feature-Branches, `main` ist geschützt
- Commit-Messages im Conventional-Commit-Format
- PRs verlinken Issue/RFC/ADR
- Tests grün, OAS-Diff bei API-Änderungen erforderlich

### 6.2 RFC-Prozess

1. Issue mit RFC-Template anlegen
2. Diskussionszeit mindestens 48 h
3. Maintainer entscheidet
4. Bei Annahme folgt ein ADR

### 6.3 ADR-Prozess

- Speicherort: `docs/adr/YYYY-MM-DD-title.md`
- Template:
  ```
  # Kontext
  # Entscheidung
  # Begründung
  # Alternativen
  # Konsequenzen
  ```

### 6.4 Code Ownership

- `CODEOWNERS` definiert Pfad-Ownership
- Änderungen außerhalb des eigenen Bereichs nur nach Abstimmung

---

## 7. Qualitätsregeln

### 7.1 Branching & Commits

- `main` bleibt geschützt; Merge nur via PR
- Feature-Branches, optionale Release-Branches
- Conventional Commits, keine Force-Pushes auf `main`

### 7.2 Tests

- Vitest ist der zentrale Test-Runner
- Coverage-Grenzen werden pro Projekt in `vitest.config.ts` gepflegt (Default ≥ 80 % Lines/Functions/Statements, Branches ≥ 65 %)
- Integrationstests verwenden Prism/Mockserver, kein direkter Internetzugang

### 7.3 API-Verträge

- OpenAPI 3.1 ist verbindlich (`apps/api/openapi/**`)
- `redocly lint` muss grün sein
- Types werden per `npm run codegen` regeneriert; Git-Diff der generierten Typen darf nicht offen sein

### 7.4 Datenschutz

- Zentrale Konstanten aus `@lokaltreu/config` (z. B. `RETENTION_DAYS = 180`) verwenden
- `npm run gdpr:check` ist Pflicht-Gate
- Audit- und Sicherheitslogs: Aufbewahrungszeit 180 Tage nachweisbar

### 7.5 Security

- Keine Secrets im Code/CI
- Secret-Scan (`gitleaks`) und Dependency-Audits verpflichtend
- Sicherheitsrelevante Libraries werden zeitnah gepatcht (Dependabot/Renovate)

### 7.6 Code-Style

- ESLint + Prettier, keine untypisierten Bereiche
- Unit-Tests stubben externe Systeme

---

## 8. Incident & Security

### 8.1 Meldeweg

- `/SECURITY.md` befolgen
- Security-Rolle sofort informieren

### 8.2 Regeln

- Hotfix ohne RFC möglich
- Nachdokumentation (ADR oder Incident-Report) binnen 24 h
- Recovery-Zeit ≤ 24 h, Audit-Trail im PR

---

## 9. Release-Prozess

### 9.1 Versionierung & Changelog

- Changesets pflegen; SemVer verpflichtend
- Changelogs generieren sich aus Changesets, manuelle Ergänzungen erlaubt

### 9.2 Tagging & Veröffentlichung

- Tagging-Schema: `vMAJOR.MINOR.PATCH`
- Release-Zyklen: On-Demand oder geplanter Release-Train (wöchentlich) je nach Team-Bedarf
- CI muss alle Gates bestehen, bevor Release freigegeben wird

---

## 10. CI-Gates (Required Checks)

| Gate        | Zweck                                   |
| ----------- | --------------------------------------- |
| `lint`      | ESLint/Prettier Style & Syntax          |
| `typecheck` | TypeScript Build (`tsc -b`)             |
| `test`      | Modultests (Vitest)                     |
| `coverage`  | Mindestabdeckung laut Projekt-Schwellen |
| `contract`  | OpenAPI-Lint, Type-Codegen, Diff sauber |
| `gdpr`      | DSGVO-Checker                           |
| `secrets`   | Secret-Scan (gitleaks)                  |
| `build`     | Produktionsfähiger Build (API/Web)      |

Alle Gates müssen grün sein, bevor Merge oder Release erfolgt.

---

## 11. Pflichtdateien & Artefakte

- `AGENTS.md` (dieses Dokument)
- `CONTRIBUTING.md` (verweist auf AGENTS)
- `CODEOWNERS`
- `SECURITY.md`
- `docs/adr/*`
- `.github/workflows/ci.yml`
- `.changeset/*`
- OpenAPI-Spezifikation (`apps/api/openapi/lokaltreu-openapi-v2.0.yaml`)
- Generierte Typen (`packages/types/src/index.d.ts`)

---

## 12. Änderungen an diesem Dokument

- Änderungen erfolgen per PR
- Maintainer **und** Security müssen zustimmen
- Kein Merge ohne grüne CI-Gates

---

## 13. Projektfakten & Sentinel-Checks

- **Single-Admin je Mandant** (`docs/ADR/0001-no-multi-admin.md`)
- **Retention**: 180 Tage für Audit- und Sicherheitslogs (über `@lokaltreu/config` abgesichert)
- **DSGVO-Checks** verpflichtend (`npm run gdpr:check`)
- **schema_drift** = 0 (API-Typen aktuell halten)

### Standardrezepte (CLI)

- `codex exec "Generiere @lokaltreu/types aus OpenAPI und fixe Imports" --role Contract-Sheriff --context @apps/api/openapi/lokaltreu-openapi-v2.0.yaml @packages/types/**`
- `codex exec "Implementiere POST /stamps/claim idempotent, Fehler RFC7807" --role Idempotency-Guardian,ProblemJSON-Arbiter,Audit-Officer --context @apps/api/openapi/** @apps/api/src/mw/** @apps/api/src/handlers/**`
- `codex exec "Schreibe Vitest Contract-Tests mit chai-openapi-response-validator" --role Contract-Sheriff,Test-Pilot --context @apps/api/openapi/** @tests/**`
- `codex exec "Erstelle Anti-Replay-Test für Idempotency-Key (10 parallel)" --role Idempotency-Guardian,Test-Pilot --context @apps/api/src/mw/idempotency.ts @tests/security/**`
- `codex exec "Füge Plan-Gate (403 PLAN_NOT_ALLOWED) inkl. Tests hinzu" --role ProblemJSON-Arbiter,Test-Pilot --context @apps/api/src/handlers/referrals.ts @apps/api/openapi/**`
- `codex exec "Implementiere Ed25519-Validierung für X-Device-Proof" --role Device-Proof-Engineer --context @apps/api/src/middleware/device-auth.ts`
- `codex exec "Aktualisiere JSDoc+README mit Beispielen" --role Docs-Keeper --context @apps/api/src/** @README.md`

Dieses Dokument ist verbindlich und wird bei Audits herangezogen.
