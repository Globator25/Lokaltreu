import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import { handleCreateDeviceRegistrationLink } from "./createRegistrationLink.handler.js";
import {
  createDeviceOnboardingService,
  type DeviceOnboardingServiceDeps,
} from "../../modules/devices/deviceOnboarding.service.js";

vi.mock("../../modules/devices/deviceOnboarding.service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../modules/devices/deviceOnboarding.service.js")
  >("../../modules/devices/deviceOnboarding.service.js");
  return {
    ...actual,
    createDeviceOnboardingService: vi.fn(),
  };
});

function makeRes() {
  const headers = new Map<string, string>();
  let body = "";
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | string[]) {
      headers.set(name, Array.isArray(value) ? value.join(",") : String(value));
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        body += chunk.toString();
      }
    },
  } as unknown as ServerResponse;

  return {
    res,
    headers,
    getBody: () => body,
  };
}

describe("handleCreateDeviceRegistrationLink", () => {
  it("returns 201 with link payload and echoes idempotency key", async () => {
    const service = {
      createRegistrationLink: vi.fn(async () => ({
        linkUrl: "https://example.test/link",
        token: "token-123",
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
    };

    vi.mocked(createDeviceOnboardingService).mockReturnValue(
      service as unknown as ReturnType<typeof createDeviceOnboardingService>,
    );

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
      logger: { info: vi.fn() } as DeviceOnboardingServiceDeps["logger"],
    };

    const req = {
      context: { admin: { tenantId: "tenant-1", adminId: "admin-1" } },
      headers: { "idempotency-key": "idem-1" },
      url: "/devices/registration-links",
    } as AdminAuthRequest;

    const { res, headers, getBody } = makeRes();

    await handleCreateDeviceRegistrationLink(req, res, deps);

    expect(res.statusCode).toBe(201);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Idempotency-Key")).toBe("idem-1");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      linkUrl: "https://example.test/link",
      token: "token-123",
      expiresAt: "2026-01-01T00:00:00.000Z",
      qrImageUrl: null,
    });

    expect(service.createRegistrationLink).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      adminId: "admin-1",
    });
  });

  it("returns 403 Problem+JSON when admin context is missing", async () => {
    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      headers: {},
      url: "/devices/registration-links",
    } as AdminAuthRequest;

    const { res, headers, getBody } = makeRes();

    await handleCreateDeviceRegistrationLink(req, res, deps);

    expect(res.statusCode).toBe(403);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 403,
      title: "Forbidden",
      detail: "Missing admin context",
      instance: "/devices/registration-links",
    });
  });

  it("surfaces service errors", async () => {
    vi.mocked(createDeviceOnboardingService).mockReturnValue({
      createRegistrationLink: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as ReturnType<typeof createDeviceOnboardingService>);

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      context: { admin: { tenantId: "tenant-1", adminId: "admin-1" } },
      headers: {},
      url: "/devices/registration-links",
    } as AdminAuthRequest;

    const { res } = makeRes();

    await expect(handleCreateDeviceRegistrationLink(req, res, deps)).rejects.toThrow("boom");
  });
});
