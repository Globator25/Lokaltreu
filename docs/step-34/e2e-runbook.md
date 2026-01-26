# Step 34 E2E Runbook (PWA DSR)

## Local

Terminal 1 (Prism mock):

```powershell
npx prism mock apps/api/openapi/lokaltreu-openapi-v2.0.yaml -p 4010 --host 127.0.0.1
```

Terminal 2 (Playwright):

```powershell
$env:LOKALTREU_API_UPSTREAM="http://127.0.0.1:4010"
$env:E2E_BASE_URL="http://127.0.0.1:3000"
npm -w apps/web run test:e2e
```

## CI

- Start Prism as a separate CI step/service on `http://127.0.0.1:4010` (background).
- Healthcheck: `GET http://127.0.0.1:4010/.well-known/jwks.json` with retries.
- Set `LOKALTREU_API_UPSTREAM=http://127.0.0.1:4010`.
- Set `E2E_BASE_URL=http://127.0.0.1:3000`.
- Run: `npm -w apps/web run test:e2e`.
