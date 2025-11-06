import { Router } from "express";
import { secureActionHandler } from "../handlers/qrTokens/secureActionHandler.js";

const router = Router();

/**
 * POST /secure-action
 * Sensitive Action mit Anti-Replay.
 * SPEC: TTL 60s via Redis SETNX(jti).
 * Bei Replay -> 429 TOKEN_REUSE + Audit + rate_token_reuse Counter.
 */
router.post("/secure-action", secureActionHandler);

export const secureActionRouter = router;


