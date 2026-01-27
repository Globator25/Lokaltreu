import { describe, expect, it } from "vitest";
import { InMemoryDeviceRegistrationLinksRepository } from "./deviceRegistrationLinks.repo.js";

describe("InMemoryDeviceRegistrationLinksRepository", () => {
  it("createRegistrationLink stores and returns a link", async () => {
    const repo = new InMemoryDeviceRegistrationLinksRepository();
    const expiresAt = new Date(Date.now() + 60_000);

    const link = await repo.createRegistrationLink({
      tenantId: "tenant-1",
      adminId: "admin-1",
      tokenHash: "hash-1",
      expiresAt,
    });

    expect(link.id).toBeTruthy();
    expect(link.tokenHash).toBe("hash-1");
    expect(link.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(link.usedAt).toBeNull();
  });

  it("getByTokenHash returns null when missing", async () => {
    const repo = new InMemoryDeviceRegistrationLinksRepository();
    const fetched = await repo.findByTokenHashForUpdate("does-not-exist");
    expect(fetched).toBeNull();
  });

  it("getByTokenHash returns link when existing", async () => {
    const repo = new InMemoryDeviceRegistrationLinksRepository();
    const expiresAt = new Date(Date.now() + 60_000);

    const link = await repo.createRegistrationLink({
      tenantId: "tenant-1",
      adminId: "admin-1",
      tokenHash: "hash-2",
      expiresAt,
    });

    const fetched = await repo.findByTokenHashForUpdate("hash-2");
    expect(fetched).not.toBeNull();
    if (!fetched) {
      throw new Error("expected link to exist");
    }
    expect(fetched.id).toBe(link.id);
  });

  it("enforces tokenHash uniqueness", async () => {
    const repo = new InMemoryDeviceRegistrationLinksRepository();
    const expiresAt = new Date(Date.now() + 60_000);

    await repo.createRegistrationLink({
      tenantId: "tenant-1",
      adminId: "admin-1",
      tokenHash: "hash-dup",
      expiresAt,
    });

    expect(() => {
      void repo.createRegistrationLink({
        tenantId: "tenant-1",
        adminId: "admin-1",
        tokenHash: "hash-dup",
        expiresAt,
      });
    }).toThrow("device_registration_links token_hash must be unique");
  });

  it("markUsed sets deviceId and usedAt", async () => {
    const repo = new InMemoryDeviceRegistrationLinksRepository();
    const expiresAt = new Date(Date.now() + 60_000);

    const link = await repo.createRegistrationLink({
      tenantId: "tenant-1",
      adminId: "admin-1",
      tokenHash: "hash-3",
      expiresAt,
    });

    await repo.markUsed({ id: link.id, deviceId: "device-1" });

    const fetched = await repo.findByTokenHashForUpdate("hash-3");
    expect(fetched).not.toBeNull();
    if (!fetched) {
      throw new Error("expected link to exist");
    }
    expect(fetched.deviceId).toBe("device-1");
    expect(fetched.usedAt).not.toBeNull();
  });

  it("markUsed throws when record does not exist", async () => {
    const repo = new InMemoryDeviceRegistrationLinksRepository();
    expect(() => {
      void repo.markUsed({ id: "missing", deviceId: "device-1" });
    }).toThrow("device_registration_links record not found");
  });
});
