# Step 33 – Endkunden-PWA – Spot Checks (Mock-first)

## Mock Setup
- Prism: http://127.0.0.1:4010 (apps/api/openapi/lokaltreu-openapi-v2.0.yaml)
- Web:  http://localhost:3000

## Contract Smoke (Prism)
- GET /referrals/link mit x-tenant-id=<uuid>, x-card-id=<uuid> => 200 OK, { refCodeURL }
- POST /stamps/claim mit idempotency-key=<uuid> und Body { qrToken } => 200 OK

## PWA UAT
- /pwa/referral?tenant=<uuid>&card=<uuid> -> refCodeURL wird angezeigt
- /pwa/scan -> qrToken eingeben -> Claim erfolgreich (mock-first)

## Quality Gates
- npm run lint: PASS
- npm run -w apps/web test -- --coverage: PASS
- npm run build: PASS

## Datenschutz
- Nur pseudonyme IDs (tenant_id, card_id); keine PII im Frontend-Logging
