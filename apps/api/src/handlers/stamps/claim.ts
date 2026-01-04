import type { IncomingMessage, ServerResponse } from "node:http";
import { problem, readJsonBody, sendJson, sendProblem } from "../http-utils.js";
import {
  StampTokenExpiredError,
  StampTokenReuseError,
  type StampService,
} from "../../modules/stamps/stamp.service.js";

type StampClaimDeps = {
  service: StampService;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
};

type StampClaimRequest = IncomingMessage & {
  body?: unknown;
};

function readCardId(req: IncomingMessage): string {
  const header = req.headers["x-card-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  return "card-anon";
}

export async function handleStampClaim(
  req: StampClaimRequest,
  res: ServerResponse,
  deps: StampClaimDeps,
) {
  const body = req.body ?? (await readJsonBody(req));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/stamps/claim"),
    );
  }

  const qrToken = (body as Record<string, unknown>)["qrToken"];
  if (typeof qrToken !== "string") {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Missing qrToken", req.url ?? "/stamps/claim"),
    );
  }

  const refValue = (body as Record<string, unknown>)["ref"];
  const ref = typeof refValue === "string" ? refValue : refValue == null ? null : undefined;
  if (ref === undefined) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid ref", req.url ?? "/stamps/claim"),
    );
  }

  try {
    const cardId = readCardId(req);
    const payload = await deps.service.claimStamp({
      qrToken,
      ref,
      cardId,
    });
    return sendJson(res, 200, payload);
  } catch (error) {
    if (error instanceof StampTokenExpiredError) {
      return sendProblem(
        res,
        problem(400, "Token expired", error.message, req.url ?? "/stamps/claim", "TOKEN_EXPIRED"),
      );
    }
    if (error instanceof StampTokenReuseError) {
      return sendProblem(
        res,
        problem(409, "Token reuse", error.message, req.url ?? "/stamps/claim", "TOKEN_REUSE"),
      );
    }
    deps.logger?.error?.("stamp claim failed", error);
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/stamps/claim",
      ),
    );
  }
}
