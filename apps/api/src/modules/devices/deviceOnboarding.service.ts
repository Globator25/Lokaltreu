import crypto from "node:crypto";

import type { DeviceRegistrationLinksRepo } from "./deviceRegistrationLinks.repo.js";
import {
  resolvePlanLimits,
  resolveTenantPlan,
  type ActiveDeviceStore,
  type TenantPlanStore,
} from "../../plan/plan-policy.js";
import { PLAN_NOT_ALLOWED_ERROR } from "../../problem/plan.js";

/**
 * Service for device onboarding (Step 18).
 * Mock-first skeleton without persistence details.
 */
export interface DeviceOnboardingService {
  createRegistrationLink(params: {
    tenantId: string;
    adminId: string;
  }): Promise<{
    linkUrl: string;
    token: string;
    expiresAt: Date;
  }>;

  confirmRegistration(params: {
    token: string;
  }): Promise<{ deviceId: string; tenantId: string }>;
}

export interface DeviceOnboardingServiceDeps {
  repo: DeviceRegistrationLinksRepo;

  logger?: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };

  audit?: {
    log: (event: string, payload: Record<string, unknown>) => Promise<void> | void;
  };

  mail?: {
    sendDeviceBoundAlert: (params: {
      tenantId: string;
      deviceId: string;
    }) => Promise<void> | void;
  };

  deviceService?: {
    bindDeviceToTenant: (params: {
      tenantId: string;
    }) => Promise<{ deviceId: string }>;
  };

  planStore?: TenantPlanStore;
  activeDeviceStore?: ActiveDeviceStore;

  buildRegistrationLinkUrl?: (token: string, tenantId: string) => string;
}

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

function generateRegistrationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export class DeviceRegistrationTokenExpiredError extends Error {
  constructor(message = "Device registration token expired or invalid") {
    super(message);
    this.name = "DeviceRegistrationTokenExpiredError";
  }
}

export class DeviceRegistrationTokenReuseError extends Error {
  constructor(message = "Device registration token already used") {
    super(message);
    this.name = "DeviceRegistrationTokenReuseError";
  }
}

export function createDeviceOnboardingService(
  deps: DeviceOnboardingServiceDeps,
): DeviceOnboardingService {
  const {
    repo,
    logger,
    audit,
    mail,
    deviceService,
    buildRegistrationLinkUrl,
  } = deps;

  return {
    async createRegistrationLink(params) {
      const token = generateRegistrationToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + DEFAULT_TOKEN_TTL_MS);

      const linkUrl =
        buildRegistrationLinkUrl?.(token, params.tenantId) ?? token;

      await repo.createRegistrationLink({
        tenantId: params.tenantId,
        adminId: params.adminId,
        tokenHash,
        expiresAt,
      });

      await audit?.log("device.registration_link.created", {
        tenantId: params.tenantId,
        expiresAt: expiresAt.toISOString(),
      });

      logger?.info?.("device registration link created", {
        tenantId: params.tenantId,
      });

      return {
        linkUrl,
        token,
        expiresAt,
      };
    },

    async confirmRegistration(params) {
      const tokenHash = hashToken(params.token);
      const link = await repo.findByTokenHashForUpdate(tokenHash);

      if (!link) {
        throw new DeviceRegistrationTokenExpiredError();
      }

      if (link.usedAt) {
        throw new DeviceRegistrationTokenReuseError();
      }

      if (link.expiresAt.getTime() <= Date.now()) {
        throw new DeviceRegistrationTokenExpiredError();
      }

      const tenantId = link.tenantId;

      if (deps.planStore && deps.activeDeviceStore) {
        const plan = resolveTenantPlan(await deps.planStore.getPlan(tenantId));
        const deviceLimit = resolvePlanLimits(plan).devicesAllowed;
        if (deviceLimit) {
          const activeCount = await deps.activeDeviceStore.countActive(tenantId);
          if (activeCount >= deviceLimit) {
            throw new Error(PLAN_NOT_ALLOWED_ERROR);
          }
        }
      }

      const deviceId =
        (await deviceService?.bindDeviceToTenant({
          tenantId,
        }))?.deviceId ?? crypto.randomUUID();

      await repo.markUsed({ id: link.id, deviceId });

      if (deps.activeDeviceStore) {
        await deps.activeDeviceStore.markActive({ tenantId, deviceId });
      }

      try {
        await mail?.sendDeviceBoundAlert({ tenantId, deviceId });
      } catch {
        logger?.warn?.("mail send failed", {
          tenantId,
          deviceId,
          template: "device_bound_alert",
        });
        await Promise.resolve(
          audit?.log("mail.send_failed", {
            tenantId,
            deviceId,
            template: "device_bound_alert",
          }),
        );
      }

      await audit?.log("device.registration.confirmed", {
        tenantId,
        deviceId,
      });

      logger?.info?.("device registration confirmed", {
        tenantId,
        deviceId,
      });

      return { deviceId, tenantId };
    },
  };
}
