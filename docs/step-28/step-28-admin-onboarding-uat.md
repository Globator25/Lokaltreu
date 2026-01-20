# Step 28 UAT: Admin-Onboarding (Mock-First)

## Objective

Validate the Admin-Onboarding wizard (Step 1–3) in Mock-First mode using Prism on port 4010 and Web on port 3000. Confirm the `/admins/register` flow, gating of Step 3, and UI stability on network errors.

## Setup

### Prerequisites

- Node.js + npm installed
- Repo root: `C:\Users\user\Projects\Lokaltreu-clean`

### Environment

`apps/web/.env.local`:

```
LOKALTREU_API_UPSTREAM=http://127.0.0.1:4010
```

Mapping-Hinweis:
- `LOKALTREU_API_UPSTREAM` steuert den Web-Proxy für `/api` (Next.js rewrites).
- Im Browser bleibt die Base-URL typischerweise `/api`, das Web leitet an `LOKALTREU_API_UPSTREAM` weiter.
- Optional (direkt im Browser): `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4010`.

## Start Commands (PowerShell)

```powershell
cd C:\Users\user\Projects\Lokaltreu-clean

# Terminal 1: Prism Mock
npm run mock:api

# Terminal 2: Web
npm run -w apps/web dev
```

## Health Checks

```powershell
# JWKS should return 200
curl -i http://127.0.0.1:4010/.well-known/jwks.json

# Admin register should return 201 (Prism example)
curl -i -X POST http://127.0.0.1:4010/admins/register `
  -H "Content-Type: application/json" `
  -d "{""email"":""admin+uat@example.com"",""password"":""verylongpassword""}"
```

Expected:
- JWKS response `200 OK`
- Register response `201 Created` with JSON body

## UAT Steps (Web UI)

1) Open `http://localhost:3000/onboarding`  
   Expected: Step 1 visible, progress shows 1/3, Datenschutz link visible.

2) Step 1 – Registrierung  
   Input:
   - Email: `admin+uat@example.com`
   - Password: `verylongpassword` (>= 12 chars)
   Click **Weiter**.  
   Expected: Step advances to 2/3. UI shows `adminId` and `tenantId`. No tokens are rendered.

3) Step 2 – Stammdaten (optional)  
   Enter optional values or leave blank. Click **Weiter**.  
   Expected: Step advances to 3/3.

4) Step 3 – Erste Kampagne  
   Expected: Step is gated with a placeholder message referencing the Campaign-API ticket. No API call is performed.

5) Network failure check (optional)  
   Stop Prism, then click **Weiter** in Step 1.  
   Expected: Friendly error message shown, loading state resets (buttons enabled again).

## CI Gates (Informational)

- Lint: `npm run lint`
- Build: `npm run build`
- Tests: `npm test --workspaces -- --coverage`
- Contract: `schema_drift = 0`

## Known Limitations

- Step 3 remains blocked until Campaign APIs are added to the OpenAPI contract.
