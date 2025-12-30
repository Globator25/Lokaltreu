import crypto from "node:crypto";

import type { DeviceRegistrationLinksRepo } from "./deviceRegistrationLinks.repo.js";

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
      const deviceId =
        (await deviceService?.bindDeviceToTenant({
          tenantId,
        }))?.deviceId ?? crypto.randomUUID();

      await repo.markUsed({ id: link.id, deviceId });

      await mail?.sendDeviceBoundAlert({
        tenantId,
        deviceId,
      });

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
