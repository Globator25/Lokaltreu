# Parallel / Integration Tests (Step 38)

This folder contains Step 38 parallel and integration tests for hot routes
(`/stamps/claim`, `/rewards/redeem`) covering anti-replay, idempotency, TTL,
and rate limits. Tests are additive and must not change production behavior.

Run (workspace):
- npm run test -w @lokaltreu/api

Run only Step-38 tests (API workspace):
- npm run test:step38 -w @lokaltreu/api

Optional (targeted, if a dedicated script exists in CI):
- npm run test:security:anti-replay -w @lokaltreu/api
