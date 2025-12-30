import type { IncomingMessage, ServerResponse } from "node:http";
import { problem, readJsonBody, sendProblem } from "../http-utils.js";
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

    const idempotencyKey = req.headers["idempotency-key"];
    if (typeof idempotencyKey === "string") {
      res.setHeader("Idempotency-Key", idempotencyKey);
    }

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
    throw error;
  }
}
