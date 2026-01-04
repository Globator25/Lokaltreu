import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "../idempotency.js";
import { sendJson } from "../../handlers/http-utils.js";

type BusinessOp = () => void;

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
  onStampClaim: BusinessOp;
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
    input.onStampClaim();
    sendJson(res, 201, { ok: true });
  }
  return getResponse();
}

describe("idempotency replay behavior", () => {
  it("replays identical requests and executes the business operation once", async () => {
    const onStampClaim = vi.fn();
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);
    const payload = { qrToken: "stub-qr" };
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "claim-12345678",
    };

    const first = await runRequest({ idempotency, onStampClaim, headers, body: payload });
    const firstBody = JSON.parse(first.body) as Record<string, unknown>;

    const second = await runRequest({ idempotency, onStampClaim, headers, body: payload });
    const secondBody = JSON.parse(second.body) as Record<string, unknown>;

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.headers["content-type"]).toContain("application/json");
    expect(second.headers["content-type"]).toContain("application/json");
    expect(firstBody.ok).toBe(true);
    expect(secondBody.ok).toBe(true);
    expect(onStampClaim).toHaveBeenCalledTimes(1);
  });
});
