# CI Gates – Security Hardening Phase

- `npm test` (Vitest) mit Coverage ≥ 80 % (Lines/Branches/Functions/Statements) – schema_drift = 0 (alle Responses via `@lokaltreu/types`).
- Replay-Anti-Pattern Guard: Tests sichern, dass parallele Requests denselben JTI nur einmal passieren lassen (`rate_token_reuse` Counter increment).
- DeviceProof Guard: ±60 s Zeitfenster, `DEVICE_PROOF_INVALID_TIME` bei Verstoß, `deviceProofFailed` Metric MUSS emittiert werden.
- Audit Guard: `secure_action.*` und `secure_device.*` Events werden WORM-append geschrieben; `globalErrorHandler.spec.ts` verifiziert, dass Runtime-Logs keine IP/UA enthalten.
- Produktions-Pipeline validiert `REPLAY_STORE` (`redis` in Prod, `memory` für lokale Tests) in Kombination mit `REDIS_URL`/`REDIS_TOKEN`.
