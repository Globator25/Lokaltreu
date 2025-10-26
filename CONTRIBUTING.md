# CONTRIBUTING

## Editor & Line Endings
- UTF-8 ohne BOM und LF sind verpflichtend für `*.yml`, `*.yaml`, `*.json`, `*.ndjson`, `*.toml` (siehe `.editorconfig`, `.gitattributes`).
- VS Code (Empfehlung, user/workspace):

```json
{
  "files.eol": "\n",
  "files.insertFinalNewline": true
}
```

- Git repo-weit:

```bash
git config core.autocrlf false
git config core.hooksPath .githooks
```

## Pre-commit Hook

- Der Hook `.githooks/pre-commit` ruft `scripts/verify-bom-and-uid.ps1`.
- Abbruch bei:
  - Byte Order Mark (BOM) in `yml|yaml|json|ndjson|toml`
  - doppelten Grafana-UIDs in JSON/NDJSON
- Aktivierung:

```bash
chmod +x .githooks/pre-commit   # falls nötig
git config core.hooksPath .githooks
```

- Manuell prüfen:

```powershell
pwsh -NoProfile -File scripts/verify-bom-and-uid.ps1
```

## Nützliche NPM-Befehle

```bash
npm run obs:verify:readonly   # Read-only BOM/UID-Check
npm run obs:provider:utf8     # provider.yaml -> UTF-8 ohne BOM
npm run obs:dedupe:dry        # UID-Dedupe Dry-Run
npm run obs:dedupe            # UID-Dedupe anwenden
npm run obs:health:grafana    # Grafana Health (Fly)
```

## CI-Erwartungen

- "OBS verify (read-only)" läuft früh im CI und im Smoke-Workflow.
- Commits/PRs sollten lokal fehlerfrei durch `npm run obs:verify:readonly` gehen.

