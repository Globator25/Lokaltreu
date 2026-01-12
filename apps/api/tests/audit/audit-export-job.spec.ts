import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeWormHash } from "../../src/modules/audit/worm/worm-writer.js";
import {
  createEd25519Signer,
  runAuditExportJob,
} from "../../src/modules/audit/export/audit-export.job.js";
import { InMemoryAuditExportRepository } from "../../src/modules/audit/export/audit-export.repo.js";

class InMemoryStorage {
  readonly objects = new Map<string, { body: string; contentType: string }>();

  async putObject(params: { key: string; body: string | Buffer; contentType: string }) {
    const body = Buffer.isBuffer(params.body) ? params.body.toString("utf8") : params.body;
    this.objects.set(params.key, { body, contentType: params.contentType });
  }
}

describe("audit export job", () => {
  it("exports NDJSON + meta + signature per tenant", async () => {
    const repo = new InMemoryAuditExportRepository();
    const storage = new InMemoryStorage();
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const signer = createEd25519Signer({
      keyId: "test-key",
      privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    });

    const base = {
      tenantId: "tenant-1",
      ts: new Date("2026-01-01T00:00:00.000Z"),
      action: "admin.login",
      result: "SUCCESS",
      deviceId: undefined,
      cardId: undefined,
      jti: undefined,
      correlationId: "corr-1",
    };

    let prevHash = "";
    for (let seq = 1; seq <= 2; seq += 1) {
      const hash = computeWormHash(base, prevHash, seq);
      repo.seedWormEvent({
        tenantId: base.tenantId,
        seq,
        ts: base.ts,
        action: base.action,
        result: base.result,
        deviceId: base.deviceId ?? null,
        cardId: base.cardId ?? null,
        jti: base.jti ?? null,
        correlationId: base.correlationId,
        prevHash,
        hash,
      });
      prevHash = hash;
    }

    await runAuditExportJob({
      deps: {
        repo,
        storage,
        signer,
        batchSize: 10,
      },
      basePrefix: "audit",
    });

    const keys = Array.from(storage.objects.keys());
    expect(keys.some((key) => key.endsWith("/events.ndjson"))).toBe(true);
    expect(keys.some((key) => key.endsWith("/meta.json"))).toBe(true);
    expect(keys.some((key) => key.endsWith("/meta.sig"))).toBe(true);

    const metaKey = keys.find((key) => key.endsWith("/meta.json"));
    const sigKey = keys.find((key) => key.endsWith("/meta.sig"));
    const meta = storage.objects.get(metaKey ?? "");
    const sig = storage.objects.get(sigKey ?? "");

    expect(meta?.contentType).toBe("application/json");
    expect(sig?.contentType).toBe("application/octet-stream");
    expect(meta?.body).toContain("\"tenant_id\":\"tenant-1\"");
    const metaJson = JSON.parse(meta?.body ?? "{}") as { object_key_prefix?: string };
    expect(metaJson.object_key_prefix).toMatch(
      /^audit\/tenant=tenant-1\/date=\d{4}-\d{2}-\d{2}\/from_\d+_to_\d+$/,
    );
    expect(meta?.body).toContain("\"sig_encoding\":\"base64\"");
    expect(meta?.body).toContain("\"sig_format\":\"ed25519-raw-64bytes-base64\"");
    expect(meta?.body).toContain("\"public_key_fingerprint_format\":\"sha256(pem-utf8-raw)\"");

    const signature = Buffer.from(sig?.body ?? "", "base64");
    const verified = crypto.verify(null, Buffer.from(meta?.body ?? "", "utf8"), publicKey, signature);
    expect(verified).toBe(true);
  });
});
