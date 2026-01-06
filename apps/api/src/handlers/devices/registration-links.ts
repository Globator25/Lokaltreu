import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import { problem, sendJson, sendProblem } from "../http-utils.js";
import {
  buildIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  validateIdempotencyKey,
  type IdempotencyStore,
} from "../../mw/idempotency.js";
import {
  createDeviceOnboardingService,
  type DeviceOnboardingServiceDeps,
} from "../../modules/devices/deviceOnboarding.service.js";
import {
  createDbDeviceRegistrationLinksRepository,
} from "../../modules/devices/deviceRegistrationLinks.db.js";
import type { DbClientLike } from "../../modules/devices/deviceRegistrationLinks.repo.js";

type DeviceRegistrationLinksHandlerDeps = Omit<DeviceOnboardingServiceDeps, "repo"> & {
  db: DbClientLike;
  idempotencyStore?: IdempotencyStore;
};

export async function handleDeviceRegistrationLinks(
  req: AdminAuthRequest,
  res: ServerResponse,
  deps: DeviceRegistrationLinksHandlerDeps,
) {
  const adminContext = req.context?.admin;
  if (!adminContext) {
    return sendProblem(
      res,
      problem(403, "Forbidden", "Missing admin context", req.url ?? "/devices/registration-links"),
    );
  }

  const rawKey = req.headers["idempotency-key"];
  const idempotencyKey = typeof rawKey === "string" ? rawKey : Array.isArray(rawKey) ? rawKey[0] : undefined;
  const validationError = validateIdempotencyKey(idempotencyKey);
  if (validationError) {
    return sendProblem(
      res,
      problem(400, "Bad Request", validationError, req.url ?? "/devices/registration-links"),
    );
  }

  const repo = createDbDeviceRegistrationLinksRepository(deps.db);
  const deviceOnboarding = createDeviceOnboardingService({
    ...deps,
    repo,
  });

  const store = deps.idempotencyStore;
  const scopedKey = store
    ? buildIdempotencyKey({
        tenantId: adminContext.tenantId,
        routeId: "POST /devices/registration-links",
        body: null,
        idempotencyKey,
      })
    : null;

  if (store && scopedKey) {
    const existing = await store.getResult(scopedKey);
    if (existing) {
      res.statusCode = existing.status;
      for (const [header, value] of Object.entries(existing.headers)) {
        res.setHeader(header, value);
      }
      res.end(existing.body);
      return;
    }

    const acquired = await store.acquireLock(scopedKey, IDEMPOTENCY_TTL_SECONDS);
    if (!acquired) {
      return sendProblem(
        res,
        problem(409, "Conflict", "Idempotency conflict", req.url ?? "/devices/registration-links"),
      );
    }
  }

  try {
    const { linkUrl, token, expiresAt } = await deviceOnboarding.createRegistrationLink({
      tenantId: adminContext.tenantId,
      adminId: adminContext.adminId,
    });

    res.setHeader("Idempotency-Key", idempotencyKey);

    deps.logger?.info?.("device registration link created", {
      tenantId: adminContext.tenantId,
      adminId: adminContext.adminId,
    });

    const payload = {
      linkUrl,
      token,
      expiresAt: expiresAt.toISOString(),
      qrImageUrl: null,
    };

    if (store && scopedKey) {
      await store.setResult(
        scopedKey,
        {
          status: 201,
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        },
        IDEMPOTENCY_TTL_SECONDS,
      );
    }

    return sendJson(res, 201, payload);
  } catch (error) {
    if (store && scopedKey) {
      await store.releaseLock(scopedKey);
    }
    // Avoid bubbling up into the global TOKEN_REUSE fallback.
    return sendProblem(
      res,
      problem(
        500,
        "Internal Server Error",
        error instanceof Error ? error.message : "Unexpected error",
        req.url ?? "/devices/registration-links",
      ),
    );
  }
}
