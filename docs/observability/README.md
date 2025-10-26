# Observability Overview

## OTEL variables: where they apply

Context: Set method → Scope

- VS Code Launch: env in `.vscode/launch.json` → Process
- Local session: `$env:...` → Current shell session
- Persistent user: `[Environment]::SetEnvironmentVariable(...,'User')` → User
- Fly: `[env]` in `fly.toml` + secrets → App
- CI: Job `env:` + secrets → Job

See also:
- Windows PowerShell specifics: `docs/observability/windows-powershell.md`
- Local stack: `docs/observability/local-otel.md`

