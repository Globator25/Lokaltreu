import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleConfirmDeviceRegistration } from "./confirmRegistration.handler.js";
import {
  createDeviceOnboardingService,
  DeviceRegistrationTokenExpiredError,
  DeviceRegistrationTokenReuseError,
  type DeviceOnboardingServiceDeps,
} from "../../modules/devices/deviceOnboarding.service.js";
import { readJsonBody } from "../http-utils.js";

vi.mock("../http-utils.js", async () => {
  const actual = await vi.importActual<
    typeof import("../http-utils.js")
  >("../http-utils.js");
  return {
    ...actual,
    readJsonBody: vi.fn(),
  };
});

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

describe("handleConfirmDeviceRegistration", () => {
  it("returns 204 and echoes idempotency key", async () => {
    vi.mocked(readJsonBody).mockResolvedValue({ token: "token-123" });
    vi.mocked(createDeviceOnboardingService).mockReturnValue({
      confirmRegistration: vi.fn(async () => ({
        deviceId: "device-1",
        tenantId: "tenant-1",
      })),
    } as unknown as ReturnType<typeof createDeviceOnboardingService>);

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
      logger: { info: vi.fn() } as DeviceOnboardingServiceDeps["logger"],
    };

    const req = {
      headers: { "idempotency-key": "idem-1" },
      url: "/devices/register/confirm",
    } as IncomingMessage;

    const { res, headers, getBody } = makeRes();

    await handleConfirmDeviceRegistration(req, res, deps);

    expect(res.statusCode).toBe(204);
    expect(headers.get("Idempotency-Key")).toBe("idem-1");
    expect(getBody()).toBe("");
  });

  it("returns 400 Problem+JSON when JSON body is invalid", async () => {
    vi.mocked(readJsonBody).mockResolvedValue(null);

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      headers: {},
      url: "/devices/register/confirm",
    } as IncomingMessage;

    const { res, headers, getBody } = makeRes();

    await handleConfirmDeviceRegistration(req, res, deps);

    expect(res.statusCode).toBe(400);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 400,
      title: "Bad Request",
      detail: "Invalid JSON body",
      instance: "/devices/register/confirm",
    });
  });

  it("returns 400 Problem+JSON when token is missing", async () => {
    vi.mocked(readJsonBody).mockResolvedValue({});

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      headers: {},
      url: "/devices/register/confirm",
    } as IncomingMessage;

    const { res, headers, getBody } = makeRes();

    await handleConfirmDeviceRegistration(req, res, deps);

    expect(res.statusCode).toBe(400);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 400,
      title: "Bad Request",
      detail: "Missing token",
      instance: "/devices/register/confirm",
    });
  });

  it("returns 400 Problem+JSON when token is expired", async () => {
    vi.mocked(readJsonBody).mockResolvedValue({ token: "token-123" });
    vi.mocked(createDeviceOnboardingService).mockReturnValue({
      confirmRegistration: vi.fn(async () => {
        throw new DeviceRegistrationTokenExpiredError("expired");
      }),
    } as unknown as ReturnType<typeof createDeviceOnboardingService>);

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      headers: {},
      url: "/devices/register/confirm",
    } as IncomingMessage;

    const { res, headers, getBody } = makeRes();

    await handleConfirmDeviceRegistration(req, res, deps);

    expect(res.statusCode).toBe(400);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 400,
      title: "Token expired",
      detail: "expired",
      instance: "/devices/register/confirm",
      error_code: "TOKEN_EXPIRED",
    });
  });

  it("returns 409 Problem+JSON when token is reused", async () => {
    vi.mocked(readJsonBody).mockResolvedValue({ token: "token-123" });
    vi.mocked(createDeviceOnboardingService).mockReturnValue({
      confirmRegistration: vi.fn(async () => {
        throw new DeviceRegistrationTokenReuseError("reused");
      }),
    } as unknown as ReturnType<typeof createDeviceOnboardingService>);

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      headers: {},
      url: "/devices/register/confirm",
    } as IncomingMessage;

    const { res, headers, getBody } = makeRes();

    await handleConfirmDeviceRegistration(req, res, deps);

    expect(res.statusCode).toBe(409);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 409,
      title: "Token reuse",
      detail: "reused",
      instance: "/devices/register/confirm",
      error_code: "TOKEN_REUSE",
    });
  });

  it("surfaces unknown errors", async () => {
    vi.mocked(readJsonBody).mockResolvedValue({ token: "token-123" });
    vi.mocked(createDeviceOnboardingService).mockReturnValue({
      confirmRegistration: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as ReturnType<typeof createDeviceOnboardingService>);

    const deps: DeviceOnboardingServiceDeps = {
      repo: {} as DeviceOnboardingServiceDeps["repo"],
    };

    const req = {
      headers: {},
      url: "/devices/register/confirm",
    } as IncomingMessage;

    const { res } = makeRes();

    await expect(handleConfirmDeviceRegistration(req, res, deps)).rejects.toThrow("boom");
  });
});
