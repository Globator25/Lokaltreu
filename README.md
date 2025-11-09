# Lokaltreu Monorepo
SSOT: apps/api/openapi/lokaltreu-openapi-v2.0.yaml (vollständig, eingecheckt). Typen werden generiert.
Priorität: SPEC → OpenAPI → ARCH → AGENTS.md → Code.
Siehe /AGENTS.md für Rollen, Gates, Rezepte.

## Build | Run | Test
- `npm install` (Root-Setup, hält Workspaces synchron)
- `npm run build` (baut API & Web laut Architektur)
- `npm run -w apps/web dev` (lokaler Web-Start; API via `npm run mock` über Prism)
- `npm test` (Vitest-Suite, inkl. Sicherheits-/Plan-Gates)

Begründung: Build | Run | Test Kommandos und SSOT-Verweis sind Pflicht laut AGENTS.md.

## OpenAPI → Typen
PowerShell (oder Shell) im Repo-Root, hält `schema_drift=0`:

```powershell
# Verzeichnis: .\
npm run codegen:types
```

Alternativ (plattformneutraler Pfad):

```powershell
npx openapi-typescript apps/api/openapi/lokaltreu-openapi-v2.0.yaml `
  -o packages/types/src/index.d.ts
```

Importbeispiel für Verträge:

```ts
import type { components } from '@lokaltreu/types';
```

Begründung: Contracts & Standards (AGENTS.md) verlangen dokumentierten Typen-Flow aus der OpenAPI-SSOT.

## Governance
Siehe [AGENTS.md](./AGENTS.md) für Rollen, Gates und PR-Checkliste.
