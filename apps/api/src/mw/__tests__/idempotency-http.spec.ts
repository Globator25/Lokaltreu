import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "../idempotency.js";
import { sendJson } from "../../handlers/http-utils.js";

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

function createMockResponse(): {
  res: ServerResponse;
  getResponse: () => MockResponse;
} {
  const buffers: Buffer[] = [];
  const headers = new Map<string, string>();
  let statusCode = 200;

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    getHeaders() {
      const record: Record<string, string> = {};
      for (const [key, value] of headers.entries()) {
        record[key] = value;
      }
      return record;
    },
    write(chunk?: unknown) {
      if (typeof chunk === "string") {
        buffers.push(Buffer.from(chunk));
      } else if (Buffer.isBuffer(chunk)) {
        buffers.push(chunk);
      }
      return true;
    },
    end(chunk?: unknown) {
      if (typeof chunk === "string") {
        buffers.push(Buffer.from(chunk));
      } else if (Buffer.isBuffer(chunk)) {
        buffers.push(chunk);
      }
    },
  } as unknown as ServerResponse;

  return {
    res,
    getResponse: () => ({
      statusCode,
      headers: Object.fromEntries(headers.entries()),
      body: Buffer.concat(buffers).toString("utf8"),
    }),
  };
}

async function runRequest(input: {
  idempotency: ReturnType<typeof createIdempotencyMiddleware>;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}): Promise<MockResponse> {
  const req = {
    method: "POST",
    url: "/stamps/claim",
    headers: input.headers,
    body: input.body,
  } as unknown as IncomingMessage;
  const { res, getResponse } = createMockResponse();

  let allowed = false;
  await input.idempotency(req, res, () => {
    allowed = true;
  });
  if (allowed) {
    sendJson(res, 201, { ok: true });
  }
  return getResponse();
}

describe("idempotency HTTP middleware", () => {
  it("rejects POST /stamps/claim without Idempotency-Key", async () => {
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);
    const res = await runRequest({
      idempotency,
      headers: {
        "content-type": "application/json",
        accept: "application/problem+json",
      },
      body: { qrToken: "stub-qr" },
    });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(body.error_code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("accepts POST /stamps/claim with Idempotency-Key", async () => {
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);
    const res = await runRequest({
      idempotency,
      headers: {
        "content-type": "application/json",
        "idempotency-key": "claim-12345678",
      },
      body: { qrToken: "stub-qr" },
    });
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(res.statusCode).toBe(201);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(body.ok).toBe(true);
  });
});
