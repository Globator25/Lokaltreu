import type { IncomingMessage, ServerResponse } from "node:http";
import { problem, readJsonBody, sendProblem } from "../http-utils.js";
import {
  createDeviceOnboardingService,
  DeviceRegistrationTokenExpiredError,
  DeviceRegistrationTokenReuseError,
  type DeviceOnboardingServiceDeps,
} from "../../modules/devices/deviceOnboarding.service.js";

export async function handleConfirmDeviceRegistration(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DeviceOnboardingServiceDeps,
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

  try {
    const deviceOnboarding = createDeviceOnboardingService(deps);
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
