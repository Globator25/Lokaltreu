import type { IncomingMessage, ServerResponse } from "node:http";
import type { DeviceAuthRequest } from "../../middleware/device-auth.js";
import { isRecord, problem, readJsonBody, sendJson, sendProblem } from "../http-utils.js";
import {
  RewardTokenExpiredError,
  RewardTokenReuseError,
  type RewardService,
} from "../../modules/rewards/reward.service.js";

type RewardRedeemRequest = IncomingMessage &
  DeviceAuthRequest & {
    body?: unknown;
  };

type RewardRedeemDeps = {
  service: RewardService;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

function readIdempotencyKey(req: IncomingMessage): string | undefined {
  const raw = req.headers["idempotency-key"];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

export async function handleRewardRedeem(req: RewardRedeemRequest, res: ServerResponse, deps: RewardRedeemDeps) {
  const body = req.body ?? (await readJsonBody(req));
  if (!isRecord(body)) {
    return sendProblem(res, problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/rewards/redeem"));
  }

  const redeemToken = body["redeemToken"];
  if (typeof redeemToken !== "string") {
    return sendProblem(res, problem(400, "Bad Request", "Missing redeemToken", req.url ?? "/rewards/redeem"));
  }

  if (!req.context?.device?.tenantId || !req.context?.device?.deviceId) {
    return sendProblem(res, problem(403, "Forbidden", "Missing device context", req.url ?? "/rewards/redeem"));
  }

  const idempotencyKey = readIdempotencyKey(req);
  if (idempotencyKey) {
    res.setHeader("Idempotency-Key", idempotencyKey);
  }

  try {
    const payload = await deps.service.redeemReward({ redeemToken });
    return sendJson(res, 200, payload);
  } catch (error) {
    if (error instanceof RewardTokenExpiredError) {
      return sendProblem(
        res,
        problem(400, "Token expired", error.message, req.url ?? "/rewards/redeem", "TOKEN_EXPIRED"),
      );
    }
    if (error instanceof RewardTokenReuseError) {
      return sendProblem(
        res,
        problem(409, "Token reuse", error.message, req.url ?? "/rewards/redeem", "TOKEN_REUSE"),
      );
    }
    deps.logger?.error?.("reward redeem failed", error);
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/rewards/redeem",
      ),
    );
  }
}

