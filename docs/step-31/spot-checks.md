# Schritt 31 – Spot-Checks (Admin Plan & Offers)

- Datum/Zeit: 2026-01-24
- Modus: Prism Mock (Mock-first) via `apps/api/openapi/lokaltreu-openapi-v2.0.yaml`, Host/Port `127.0.0.1:4010`
- Web UI: `/admin/plan` rendert; Calls: `GET /admins/plan`, `GET /admins/offers/current`, `PUT /admins/offers/current` (Idempotency-Key gesetzt)
- Erwartung: Offer speichern/clearen aktualisiert UI; `offer: null` wird akzeptiert und angezeigt
- CI lokal: `npm run -w apps/web build`, `npm run lint`, `npm run test`, `npm run build` ✅
