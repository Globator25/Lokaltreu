import { describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import { handleReportingSummary } from "./summary.js";

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

describe("handleReportingSummary", () => {
  it("returns 403 Problem+JSON when admin context is missing", async () => {
    const deps = {
      service: { getSummary: vi.fn() },
    };

    const req = {
      headers: {},
      url: "/admins/reporting/summary",
    } as AdminAuthRequest;

    const { res, headers, getBody } = makeRes();

    await handleReportingSummary(req, res, deps);

    expect(res.statusCode).toBe(403);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 403,
      title: "Forbidden",
      detail: "Missing admin context",
      instance: "/admins/reporting/summary",
    });
  });

  it("returns 200 with summary payload", async () => {
    const deps = {
      service: {
        getSummary: vi.fn(async () => ({
          totalStamps: 12,
          totalRewards: 3,
        })),
      },
    };

    const req = {
      context: { admin: { tenantId: "tenant-1", adminId: "admin-1" } },
      headers: {},
      url: "/admins/reporting/summary",
    } as AdminAuthRequest;

    const { res, headers, getBody } = makeRes();

    await handleReportingSummary(req, res, deps);

    expect(res.statusCode).toBe(200);
    expect(headers.get("Content-Type")).toBe("application/json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({ totalStamps: 12, totalRewards: 3 });

    expect(deps.service.getSummary).toHaveBeenCalledWith({ tenantId: "tenant-1" });
  });

  it("returns Problem+JSON when service throws", async () => {
    const deps = {
      service: {
        getSummary: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    };

    const req = {
      context: { admin: { tenantId: "tenant-1", adminId: "admin-1" } },
      headers: {},
      url: "/admins/reporting/summary",
    } as AdminAuthRequest;

    const { res, headers, getBody } = makeRes();

    await handleReportingSummary(req, res, deps);

    expect(res.statusCode).toBe(500);
    expect(headers.get("Content-Type")).toBe("application/problem+json");

    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      status: 500,
      title: "Internal Server Error",
      detail: "Unexpected error",
      instance: "/admins/reporting/summary",
    });
    expect(typeof payload.correlation_id).toBe("string");
  });
});
