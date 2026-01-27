import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createS3Client } from "../../src/modules/audit/export/s3-storage.js";

describe("audit export s3-storage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses path-style URLs by default and sends signed PUT request", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", text: async () => "" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createS3Client({
      bucket: "audit-bucket",
      region: "eu-central-1",
      accessKeyId: "access",
      secretAccessKey: "secret",
      endpoint: "https://storage.example.com/",
    });

    await client.putObject({
      key: "tenant=tenant-a/from_1_to_2/meta.json",
      body: "{}",
      contentType: "application/json",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      "https://storage.example.com/audit-bucket/tenant=tenant-a/from_1_to_2/meta.json",
    );
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Amz-Content-Sha256": expect.any(String),
      "X-Amz-Date": "20260127T120000Z",
      Authorization: expect.stringContaining("AWS4-HMAC-SHA256 Credential=access/20260127/eu-central-1/s3/aws4_request"),
    });
    expect(init?.body).toBeInstanceOf(ArrayBuffer);
  });

  it("supports virtual-host-style URLs when pathStyle=false", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", text: async () => "" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createS3Client({
      bucket: "audit-bucket",
      region: "eu-central-1",
      accessKeyId: "access",
      secretAccessKey: "secret",
      endpoint: "https://storage.example.com",
      pathStyle: false,
    });

    await client.putObject({
      key: "events.ndjson",
      body: Buffer.from("line-1\nline-2", "utf8"),
      contentType: "application/x-ndjson",
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://storage.example.com/events.ndjson");
  });

  it("throws a descriptive error when S3 responds with non-ok", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "denied",
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createS3Client({
      bucket: "audit-bucket",
      region: "eu-central-1",
      accessKeyId: "access",
      secretAccessKey: "secret",
    });

    await expect(
      client.putObject({ key: "meta.json", body: "{}", contentType: "application/json" }),
    ).rejects.toThrowError("S3 upload failed: 403 Forbidden denied");
  });
});
