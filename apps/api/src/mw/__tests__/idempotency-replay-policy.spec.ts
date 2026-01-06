import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "../idempotency.js";
import { problem, sendJson, sendProblem } from "../../handlers/http-utils.js";

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

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
  handler: Handler;
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
    await input.handler(req, res);
  }
  return getResponse();
}

describe("idempotency replay policy", () => {
  it("caches 2xx responses and replays status/body + Idempotency-Key", async () => {
    let handlerCalls = 0;
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);
    const handler = (_req: IncomingMessage, res: ServerResponse) => {
      handlerCalls += 1;
      sendJson(res, 201, { ok: true });
    };

    const payload = { qrToken: "token-200" };
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-200-1",
    };

    const first = await runRequest({ idempotency, handler, headers, body: payload });
    const firstBody = JSON.parse(first.body) as Record<string, unknown>;
    expect(first.statusCode).toBe(201);
    expect(firstBody.ok).toBe(true);

    const second = await runRequest({ idempotency, handler, headers, body: payload });
    const secondBody = JSON.parse(second.body) as Record<string, unknown>;
    expect(second.statusCode).toBe(201);
    expect(secondBody).toEqual(firstBody);
    expect(second.headers["idempotency-key"]).toBe("idem-200-1");
    expect(handlerCalls).toBe(1);
  });

  it("caches 4xx responses and replays Problem+JSON", async () => {
    let handlerCalls = 0;
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);
    const handler = (_req: IncomingMessage, res: ServerResponse) => {
      handlerCalls += 1;
      sendProblem(res, problem(409, "Conflict", "Stub conflict", "/stamps/claim", "IDEMPOTENCY_CONFLICT"));
    };

    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-409-1",
    };
    const payload = { qrToken: "token-409" };

    const first = await runRequest({ idempotency, handler, headers, body: payload });
    const firstBody = JSON.parse(first.body) as Record<string, unknown>;
    expect(first.statusCode).toBe(409);
    expect(first.headers["content-type"]).toContain("application/problem+json");
    expect(firstBody.error_code).toBe("IDEMPOTENCY_CONFLICT");

    const second = await runRequest({ idempotency, handler, headers, body: payload });
    const secondBody = JSON.parse(second.body) as Record<string, unknown>;
    expect(second.statusCode).toBe(409);
    expect(second.headers["content-type"]).toContain("application/problem+json");
    expect(secondBody).toEqual(firstBody);
    expect(second.headers["idempotency-key"]).toBe("idem-409-1");
    expect(handlerCalls).toBe(1);
  });

  it("does not cache 5xx responses", async () => {
    let mode: "error" | "ok" = "error";
    let handlerCalls = 0;
    const store = new InMemoryIdempotencyStore();
    const idempotency = createIdempotencyMiddleware(store);
    const handler = (_req: IncomingMessage, res: ServerResponse) => {
      handlerCalls += 1;
      if (mode === "error") {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/problem+json");
        res.end(JSON.stringify(problem(500, "Internal Server Error", "Stub error", "/stamps/claim", "TOKEN_REUSE")));
        return;
      }
      sendJson(res, 200, { ok: true });
    };

    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-500-1",
    };
    const payload = { qrToken: "token-500" };

    const first = await runRequest({ idempotency, handler, headers, body: payload });
    expect(first.statusCode).toBe(500);

    mode = "ok";
    const second = await runRequest({ idempotency, handler, headers, body: payload });
    const secondBody = JSON.parse(second.body) as Record<string, unknown>;
    expect(second.statusCode).toBe(200);
    expect(secondBody.ok).toBe(true);
    expect(handlerCalls).toBe(2);
  });
});
