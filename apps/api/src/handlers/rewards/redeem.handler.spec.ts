import { describe, expect, it, vi, beforeEach } from "vitest";

// ✅ IMPORTANT: factory must not reference top-level vars (hoisted)
type ResLike = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

vi.mock("../http-utils.js", () => {
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  return {
    isRecord,
    readJsonBody: vi.fn(async () => ({})),
    problem: vi.fn(
      (status: number, title: string, detail: string, instance: string, error_code?: string) => ({
        status,
        title,
        detail,
        instance,
        error_code,
      }),
    ),
    sendJson: vi.fn((res: ResLike, status: number, payload: unknown) => {
      res.statusCode = status;
      res.end(JSON.stringify(payload));
    }),
    sendProblem: vi.fn((res: ResLike, payload: unknown) => {
      const record = payload as Record<string, unknown>;
      const status = typeof record.status === "number" ? record.status : 500;
      res.statusCode = status;
      res.end(JSON.stringify(payload));
    }),
  };
});

type FakeReq = {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  context?: {
    device?: {
      tenantId?: string;
      deviceId?: string;
    };
  };
};

type FakeRes = ResLike;

function createResCapture() {
  const headers: Record<string, string> = {};
  let body = "";
  const res: FakeRes = {
    statusCode: 200,
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    end: (chunk?: string) => {
      if (chunk) {
        body += chunk;
      }
    },
  };
  return {
    res,
    headers,
    getBody: () => body,
  };
}

function makeReq(partial?: Partial<FakeReq>): FakeReq {
  return {
    url: "/rewards/redeem",
    headers: {},
    ...partial,
  };
}

describe("handleRewardRedeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is not a record (invalid JSON body)", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");

    const req = makeReq({ body: "nope" });
    const { res, getBody } = createResCapture();

    await handleRewardRedeem(req, res, {
      service: { redeemReward: vi.fn() },
    });

    expect(httpUtils.sendProblem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(400);
    expect(payload.title).toBe("Bad Request");
    expect(payload.detail).toBe("Invalid JSON body");
    expect(payload.instance).toBe("/rewards/redeem");
  });

  it("reads JSON body when req.body is undefined", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");

    vi.mocked(httpUtils.readJsonBody).mockResolvedValueOnce({ redeemToken: "abc" });

    const req = makeReq({
      body: undefined,
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res } = createResCapture();

    const redeemReward = vi.fn().mockResolvedValue({ ok: true });
    await handleRewardRedeem(req, res, { service: { redeemReward } });

    expect(httpUtils.readJsonBody).toHaveBeenCalledTimes(1);
    expect(httpUtils.sendJson).toHaveBeenCalledWith(expect.anything(), 200, { ok: true });
  });

  it("returns 400 when redeemToken is missing", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");

    const req = makeReq({ body: {} });
    const { res, getBody } = createResCapture();

    await handleRewardRedeem(req, res, {
      service: { redeemReward: vi.fn() },
    });

    expect(httpUtils.sendProblem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(400);
    expect(payload.detail).toBe("Missing redeemToken");
  });

  it("returns 403 when device context is missing", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");

    const req = makeReq({
      body: { redeemToken: "abc" },
      context: { device: { tenantId: "t1" } }, // deviceId missing
    });
    const { res, getBody } = createResCapture();

    await handleRewardRedeem(req, res, {
      service: { redeemReward: vi.fn() },
    });

    expect(httpUtils.sendProblem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(403);
    expect(payload.title).toBe("Forbidden");
    expect(payload.detail).toBe("Missing device context");
  });

  it("sets Idempotency-Key response header when request includes idempotency-key (string)", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");

    const req = makeReq({
      headers: { "idempotency-key": "idem-1" },
      body: { redeemToken: "abc" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res, headers } = createResCapture();

    const redeemReward = vi.fn().mockResolvedValue({ ok: true });
    await handleRewardRedeem(req, res, { service: { redeemReward } });

    expect(headers["idempotency-key"]).toBe("idem-1");
    expect(httpUtils.sendJson).toHaveBeenCalledWith(expect.anything(), 200, { ok: true });
  });

  it("sets Idempotency-Key response header when request includes idempotency-key (array)", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");

    const req = makeReq({
      headers: { "idempotency-key": ["idem-a", "idem-b"] },
      body: { redeemToken: "abc" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res, headers } = createResCapture();

    const redeemReward = vi.fn().mockResolvedValue({ ok: true });
    await handleRewardRedeem(req, res, { service: { redeemReward } });

    expect(headers["idempotency-key"]).toBe("idem-a");
  });

  it("returns 200 and payload on success", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");

    const req = makeReq({
      body: { redeemToken: "token-123" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res } = createResCapture();

    const payload = { redeemed: true };
    const redeemReward = vi.fn().mockResolvedValue(payload);

    await handleRewardRedeem(req, res, { service: { redeemReward } });

    expect(redeemReward).toHaveBeenCalledWith({ redeemToken: "token-123" });
    expect(httpUtils.sendJson).toHaveBeenCalledWith(expect.anything(), 200, payload);
  });

  it("maps RewardTokenExpiredError to 400 TOKEN_EXPIRED", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");
    const { RewardTokenExpiredError } = await import("../../modules/rewards/reward.service.js");

    const req = makeReq({
      body: { redeemToken: "expired" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res, getBody } = createResCapture();

    const redeemReward = vi.fn().mockRejectedValue(new RewardTokenExpiredError("expired"));
    await handleRewardRedeem(req, res, { service: { redeemReward } });

    expect(httpUtils.sendProblem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(400);
    expect(payload.title).toBe("Token expired");
    expect(payload.error_code).toBe("TOKEN_EXPIRED");
  });

  it("maps RewardTokenReuseError to 409 TOKEN_REUSE", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");
    const httpUtils = await import("../http-utils.js");
    const { RewardTokenReuseError } = await import("../../modules/rewards/reward.service.js");

    const req = makeReq({
      body: { redeemToken: "reuse" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res, getBody } = createResCapture();

    const redeemReward = vi.fn().mockRejectedValue(new RewardTokenReuseError("reuse"));
    await handleRewardRedeem(req, res, { service: { redeemReward } });

    expect(httpUtils.sendProblem).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(409);
    expect(payload.title).toBe("Token reuse");
    expect(payload.error_code).toBe("TOKEN_REUSE");
  });

  it("logs and returns 500 on unexpected errors (Error instance)", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");

    const req = makeReq({
      body: { redeemToken: "boom" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res, getBody } = createResCapture();

    const redeemReward = vi.fn().mockRejectedValue(new Error("kaboom"));
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    await handleRewardRedeem(req, res, { service: { redeemReward }, logger });

    expect(logger.error).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(500);
    expect(payload.title).toBe("Internal Server Error");
    expect(payload.detail).toBe("kaboom");
  });

  it("returns 500 with 'Unexpected error' when thrown value is not an Error", async () => {
    const { handleRewardRedeem } = await import("./redeem.js");

    const req = makeReq({
      body: { redeemToken: "boom" },
      context: { device: { tenantId: "t1", deviceId: "d1" } },
    });
    const { res, getBody } = createResCapture();

    const redeemReward = vi.fn().mockRejectedValue("no-error-object");
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    await handleRewardRedeem(req, res, { service: { redeemReward }, logger });

    expect(logger.error).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(getBody()) as Record<string, unknown>;
    expect(payload.status).toBe(500);
    expect(payload.detail).toBe("Unexpected error");
  });
});
