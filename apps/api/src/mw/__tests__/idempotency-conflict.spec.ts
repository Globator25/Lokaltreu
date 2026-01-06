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

async function runIdempotency(input: {
  idempotency: ReturnType<typeof createIdempotencyMiddleware>;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}): Promise<{
  allowed: boolean;
  req: IncomingMessage;
  res: ServerResponse;
  getResponse: () => MockResponse;
}> {
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
  return { allowed, req, res, getResponse };
}

describe("idempotency conflict behavior", () => {
  it("returns 409 for parallel requests with same Idempotency-Key and body", async () => {
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);

    const payload = { qrToken: "token-A", cardId: "card-A" };
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "conflict-key-1",
    };

    const first = await runIdempotency({ idempotency, headers, body: payload });
    expect(first.allowed).toBe(true);

    const second = await runIdempotency({ idempotency, headers, body: payload });
    const secondBody = JSON.parse(second.getResponse().body) as Record<string, unknown>;
    expect(second.allowed).toBe(false);
    expect(second.getResponse().statusCode).toBe(409);
    expect(second.getResponse().headers["content-type"]).toContain("application/problem+json");
    expect(secondBody.error_code).toBe("IDEMPOTENCY_CONFLICT");
    expect(typeof secondBody.type).toBe("string");
    expect(typeof secondBody.title).toBe("string");
    expect(secondBody.status).toBe(409);
    expect(typeof secondBody.detail).toBe("string");
    expect(typeof secondBody.correlation_id).toBe("string");

    sendJson(first.res, 201, { ok: true });
    const firstResponse = first.getResponse();
    expect(firstResponse.statusCode).toBe(201);
    expect(firstResponse.headers["content-type"]).toContain("application/json");
  });
});
