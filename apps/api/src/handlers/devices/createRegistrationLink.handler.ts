import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import { problem, sendJson, sendProblem } from "../http-utils.js";
import {
  createDeviceOnboardingService,
  type DeviceOnboardingServiceDeps,
} from "../../modules/devices/deviceOnboarding.service.js";

export async function handleCreateDeviceRegistrationLink(
  req: AdminAuthRequest,
  res: ServerResponse,
  deps: DeviceOnboardingServiceDeps,
) {
  const adminContext = req.context?.admin;
  if (!adminContext) {
    return sendProblem(
      res,
      problem(403, "Forbidden", "Missing admin context", req.url ?? "/devices/registration-links"),
    );
  }

  const deviceOnboarding = createDeviceOnboardingService(deps);
  const { linkUrl, token, expiresAt } = await deviceOnboarding.createRegistrationLink({
    tenantId: adminContext.tenantId,
    adminId: adminContext.adminId,
  });

  const idempotencyKey = req.headers["idempotency-key"];
  if (typeof idempotencyKey === "string") {
    res.setHeader("Idempotency-Key", idempotencyKey);
  }

  deps.logger?.info?.("device registration link created", {
    tenantId: adminContext.tenantId,
    adminId: adminContext.adminId,
  });

  return sendJson(res, 201, {
    linkUrl,
    token,
    expiresAt: expiresAt.toISOString(),
    qrImageUrl: null,
  });
}
