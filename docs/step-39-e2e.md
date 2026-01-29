# Schritt 39 – E2E (Playwright) Quickstart

## 1‑Minute Quickstart (lokal)

Terminal 1 (Prism):
```bash
npx prism mock apps/api/openapi/lokaltreu-openapi-v2.0.yaml -p 4010 --host 127.0.0.1
```

Terminal 2 (Next dev + Smoke):
```bash
# Windows (PowerShell)
$env:LOKALTREU_API_UPSTREAM="http://127.0.0.1:4010"
$env:E2E_BASE_URL="http://127.0.0.1:3000"
npm -w apps/web run test:e2e:smoke

# macOS/Linux (bash)
export LOKALTREU_API_UPSTREAM="http://127.0.0.1:4010"
export E2E_BASE_URL="http://127.0.0.1:3000"
npm -w apps/web run test:e2e:smoke
```

## Full Suite
```bash
npm -w apps/web run test:e2e:full
```

## CI Hinweis
- CI nutzt **nur Smoke**: `npm -w apps/web run test:e2e:ci`
- Flags (CI): `--workers=1`, `--retries=1`, `--reporter=line`

## Troubleshooting

**Port in use (3000/4010)**
```bash
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000,4010 | Format-Table -AutoSize
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id <PID> -Force

# macOS/Linux
lsof -i :3000 -i :4010
kill -9 <PID>
```

**Prism: EADDRINUSE**
- Port belegt → anderen Port wählen oder Prozess beenden.
- Beispiel: `-p 4011` + `LOKALTREU_API_UPSTREAM=http://127.0.0.1:4011`

**Next Port Drift**
- Falls `3000` belegt, setze `E2E_BASE_URL` passend:
  - z. B. `http://127.0.0.1:3002`

**E2E_BASE_URL setzen**
- Muss auf die Next‑Dev‑URL zeigen, z. B. `http://127.0.0.1:3000`.
