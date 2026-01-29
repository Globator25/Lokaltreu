import { describe, it, expect } from "vitest";
import {
  readJsonBody,
  parseBearer,
  normalizeIp,
  normalizeUa,
} from "./http-utils.js";

// Minimaler AsyncIterable-"Request" für readJsonBody + Header/Socket-Felder
function makeReq(params: {
  chunks?: Array<string | Buffer>;
  authorization?: string;
  ua?: string | string[];
  remoteAddress?: string;
}) {
  const chunks = params.chunks ?? [];

  const req: {
    headers: {
      authorization?: string;
      "user-agent"?: string | string[];
    };
    socket: {
      remoteAddress?: string;
    };
    [Symbol.asyncIterator](): AsyncIterator<string | Buffer>;
  } = {
    headers: {
      authorization: params.authorization,
      "user-agent": params.ua,
    },
    socket: {
      remoteAddress: params.remoteAddress,
    },
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };

  return req;
}

describe("handlers/http-utils", () => {
  it("readJsonBody returns null when body is empty", async () => {
    const req = makeReq({ chunks: [] });
    await expect(readJsonBody(req)).resolves.toBeNull();
  });

  it("readJsonBody parses JSON from string chunks (record)", async () => {
    const req = makeReq({ chunks: ['{"a":1}'] });
    await expect(readJsonBody(req)).resolves.toEqual({ a: 1 });
  });

  it("readJsonBody parses JSON from Buffer chunks (record)", async () => {
    const req = makeReq({ chunks: [Buffer.from('{"b":"x"}', "utf8")] });
    await expect(readJsonBody(req)).resolves.toEqual({ b: "x" });
  });

  it("readJsonBody returns null for invalid JSON", async () => {
    const req = makeReq({ chunks: ["{not json"] });
    await expect(readJsonBody(req)).resolves.toBeNull();
  });

  it("readJsonBody returns null when parsed JSON is not a record (array)", async () => {
    const req = makeReq({ chunks: ["[1,2,3]"] });
    await expect(readJsonBody(req)).resolves.toBeNull();
  });

  it("parseBearer returns null when authorization header missing", () => {
    const req = makeReq({});
    expect(parseBearer(req)).toBeNull();
  });

  it("parseBearer returns null for non-bearer scheme", () => {
    const req = makeReq({ authorization: "Basic abc" });
    expect(parseBearer(req)).toBeNull();
  });

  it("parseBearer returns null when bearer token missing", () => {
    const req = makeReq({ authorization: "Bearer" });
    expect(parseBearer(req)).toBeNull();
  });

  it("parseBearer returns token for valid bearer header (case-insensitive scheme)", () => {
    const req = makeReq({ authorization: "bEaReR mytoken" });
    expect(parseBearer(req)).toBe("mytoken");
  });

  it("normalizeIp returns remoteAddress when present, otherwise undefined", () => {
    expect(normalizeIp(makeReq({ remoteAddress: "127.0.0.1" }))).toBe("127.0.0.1");
    expect(normalizeIp(makeReq({ remoteAddress: undefined }))).toBeUndefined();
  });

  it("normalizeUa returns ua when string, otherwise undefined", () => {
    expect(normalizeUa(makeReq({ ua: "Mozilla/5.0" }))).toBe("Mozilla/5.0");
    expect(normalizeUa(makeReq({ ua: ["a", "b"] }))).toBeUndefined();
    expect(normalizeUa(makeReq({ ua: undefined }))).toBeUndefined();
  });
});
