import type { IncomingMessage, ServerResponse } from "node:http";
import { problem, readJsonBody, sendProblem } from "../http-utils.js";
import { validateIdempotencyKey } from "../../mw/idempotency.js";
import {
  createDeviceOnboardingService,
  DeviceRegistrationTokenExpiredError,
  DeviceRegistrationTokenReuseError,
  type DeviceOnboardingServiceDeps,
} from "../../modules/devices/deviceOnboarding.service.js";
import {
  createDbDeviceRegistrationLinksRepository,
} from "../../modules/devices/deviceRegistrationLinks.db.js";
import type { DbClientLike } from "../../modules/devices/deviceRegistrationLinks.repo.js";

type DeviceRegistrationConfirmDeps = Omit<DeviceOnboardingServiceDeps, "repo"> & {
  db: DbClientLike;
};

export async function handleDeviceRegistrationConfirm(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DeviceRegistrationConfirmDeps,
) {
  const rawKey = req.headers["idempotency-key"];
  const idempotencyKey = typeof rawKey === "string" ? rawKey : Array.isArray(rawKey) ? rawKey[0] : undefined;
  const validationError = validateIdempotencyKey(idempotencyKey);
  if (validationError) {
    return sendProblem(
      res,
      problem(400, "Bad Request", validationError, req.url ?? "/devices/register/confirm"),
    );
  }

  const body = await readJsonBody(req);
  if (!body) {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Invalid JSON body", req.url ?? "/devices/register/confirm"),
    );
  }

  const token = body["token"];
  if (typeof token !== "string") {
    return sendProblem(
      res,
      problem(400, "Bad Request", "Missing token", req.url ?? "/devices/register/confirm"),
    );
  }

  const repo = createDbDeviceRegistrationLinksRepository(deps.db);
  const deviceOnboarding = createDeviceOnboardingService({
    ...deps,
    repo,
  });

  try {
    const { deviceId, tenantId } = await deviceOnboarding.confirmRegistration({ token });

    res.setHeader("Idempotency-Key", idempotencyKey);

    deps.logger?.info?.("device registration confirmed", {
      tenantId,
      deviceId,
    });

    res.statusCode = 204;
    res.end();
  } catch (error) {
    if (error instanceof DeviceRegistrationTokenExpiredError) {
      return sendProblem(
        res,
        problem(
          400,
          "Token expired",
          error.message,
          req.url ?? "/devices/register/confirm",
          "TOKEN_EXPIRED",
        ),
      );
    }
    if (error instanceof DeviceRegistrationTokenReuseError) {
      return sendProblem(
        res,
        problem(
          409,
          "Token reuse",
          error.message,
          req.url ?? "/devices/register/confirm",
          "TOKEN_REUSE",
        ),
      );
    }
    // Avoid bubbling up into the global TOKEN_REUSE fallback.
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/devices/register/confirm",
      ),
    );
  }
}
