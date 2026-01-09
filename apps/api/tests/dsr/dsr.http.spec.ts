import { afterEach, describe, expect, it } from "vitest";
import type { DsrServerHandle } from "../../src/dsr-test-server.js";
import { startDsrServer } from "../../src/dsr-test-server.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data: unknown = await res.json();
  if (!isRecord(data)) {
    throw new Error("Expected JSON object");
  }
  return data;
}

describe("dsr http integration", () => {
  let serverHandle: DsrServerHandle | null = null;

  afterEach(async () => {
    if (serverHandle) {
      await new Promise<void>((resolve) => serverHandle?.server.close(() => resolve()));
      serverHandle = null;
    }
  });

  it("creates tombstone when fulfilling delete DSR", async () => {
    serverHandle = await startDsrServer();

    const createRes = await fetch(`${serverHandle.baseUrl}/dsr/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "dsr-create-1",
        "x-tenant-id": "tenant-1",
      },
      body: JSON.stringify({
        requestType: "DELETE",
        subject: { subject_type: "card_id", subject_id: "card-123" },
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await readJson(createRes);
    const dsrId = created.dsrRequestId as string;

    const fulfillRes = await fetch(`${serverHandle.baseUrl}/dsr/requests/${dsrId}/fulfill`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "dsr-fulfill-1",
        "x-tenant-id": "tenant-1",
      },
      body: JSON.stringify({ action: "DELETE" }),
    });

    expect(fulfillRes.status).toBe(200);

    const tombstones = await serverHandle.tombstoneRepo.listTombstones("tenant-1");
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]?.subjectId).toBe("card-123");
  });

  it("does not create a second tombstone on fulfill retry", async () => {
    serverHandle = await startDsrServer();

    const createRes = await fetch(`${serverHandle.baseUrl}/dsr/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "dsr-create-2",
        "x-tenant-id": "tenant-1",
      },
      body: JSON.stringify({
        requestType: "DELETE",
        subject: { subject_type: "card_id", subject_id: "card-789" },
      }),
    });
    const created = await readJson(createRes);
    const dsrId = created.dsrRequestId as string;

    await fetch(`${serverHandle.baseUrl}/dsr/requests/${dsrId}/fulfill`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "dsr-fulfill-2",
        "x-tenant-id": "tenant-1",
      },
      body: JSON.stringify({ action: "DELETE" }),
    });

    const retryRes = await fetch(`${serverHandle.baseUrl}/dsr/requests/${dsrId}/fulfill`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "dsr-fulfill-3",
        "x-tenant-id": "tenant-1",
      },
      body: JSON.stringify({ action: "DELETE" }),
    });

    expect(retryRes.status).toBe(409);

    const tombstones = await serverHandle.tombstoneRepo.listTombstones("tenant-1");
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]?.subjectId).toBe("card-789");
  });

  it("returns pending status for newly created DSR", async () => {
    serverHandle = await startDsrServer();

    const createRes = await fetch(`${serverHandle.baseUrl}/dsr/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "dsr-create-3",
        "x-tenant-id": "tenant-1",
      },
      body: JSON.stringify({
        requestType: "DELETE",
        subject: { subject_type: "device_id", subject_id: "device-555" },
      }),
    });
    const created = await readJson(createRes);
    const dsrId = created.dsrRequestId as string;

    const statusRes = await fetch(`${serverHandle.baseUrl}/dsr/requests/${dsrId}`, {
      method: "GET",
      headers: {
        "x-tenant-id": "tenant-1",
      },
    });

    expect(statusRes.status).toBe(200);
    const statusBody = await readJson(statusRes);
    expect(statusBody.status).toBe("PENDING");
    expect(statusBody.fulfilledAt).toBeNull();
  });

  it("returns Problem+JSON for invalid dsr_id", async () => {
    serverHandle = await startDsrServer();

    const res = await fetch(`${serverHandle.baseUrl}/dsr/requests/not-a-uuid`, {
      method: "GET",
      headers: {
        "x-tenant-id": "tenant-1",
      },
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    const body = await readJson(res);
    expect(body.status).toBe(400);
    expect(typeof body.correlation_id).toBe("string");
  });
});
