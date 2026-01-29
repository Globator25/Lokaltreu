# Step 38 — Idempotency & Parallel Test Cases (DoD)

Kurzüberblick der nachweisbaren Fälle (auditierbar, keine PII).

## Anti‑Replay Parallel (Stamp Claim)
- Erwartung: exakt 1× Erfolg und 9× Konflikt (409).
- Test: `apps/api/tests/parallel/stamps-claim.step38.parallel.spec.ts`.
- Hinweis: Statuscode 200 entspricht aktuellem OpenAPI/Implementierungsstand.

## Double Redeem (Rewards)
- Erwartung: exakt 1× Erfolg, restliche Requests Konflikt (typisch 409).
- Test: `apps/api/tests/parallel/rewards-redeem.step38.parallel.spec.ts`.

## TTL Expiry
- Erwartung: abgelaufene Tokens liefern Problem+JSON (400 TOKEN_EXPIRED).
- Tests:
  - `apps/api/tests/parallel/ttl-expiry.step38.spec.ts` (StampToken + RewardToken).

## Rate‑Limits Burst
- Erwartung: mindestens eine 429 innerhalb des Bursts.
- Retry‑After: wenn vorhanden, positive Zahl.
- Test: `apps/api/tests/parallel/rate-limit.step38.spec.ts`.

## Idempotency‑Key Cases
- Same key + same body → Response wird aus Idempotency‑Cache repliziert (identischer Status/Body).
- Same key + different body → Konflikt (409) wegen Idempotency‑Scope (Body‑Hash).
- Referenzen:
  - `tests/security/idempotency.test.ts`
  - `apps/api/src/mw/__tests__/idempotency-conflict.spec.ts`
  - `apps/api/src/mw/__tests__/idempotency-replay-policy.spec.ts`
