# Security Gates Preflight (Windows 11 / PowerShell 7)

Kurze Checkliste zum Vorbereiten lokaler Security-Gates-Laeufe unter Windows 11 mit PowerShell 7.

## Checkliste

### 1) Tools (erforderlich)
- PowerShell 7 (`pwsh`)
- Node.js (Version gemaess Repo-Standard)
- npm (via Node.js)
- Git

### 2) ENV-Variablen (minimal)
- `NODE_ENV=development`
- `CI=false`
- Falls benoetigt: `CODEX_HOME` (nur bei Skill-Workflows)

### 3) Logging/Transcript
- Log-Ordner anlegen: `artifacts/`
- Transcript starten (Beispiel):

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = "artifacts/codex-$ts.log"
Start-Transcript -Path $logPath -Append
```

- Transcript stoppen:

```powershell
Stop-Transcript
```

### 4) Fehlerabbruch erzwingen
- Fehler als Abbruch behandeln:

```powershell
$ErrorActionPreference = 'Stop'
```

- Optional: bei Fehlern sofort beenden (Beispiel):

```powershell
try {
  npm test
} catch {
  Write-Error $_
  Exit 1
}
```
