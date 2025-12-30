import crypto from "node:crypto";

/**
 * Repository for device_registration_links (Step 18 - Device onboarding).
 * In-memory adapter for tests and mock-first development.
 */

export interface DeviceRegistrationLink {
  id: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  deviceId: string | null;
  createdByAdminId: string | null;
  createdAt: Date;
}

export interface DbClientLike {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
}

export type DbTransactionLike = DbClientLike;

export interface DeviceRegistrationLinksRepository {
  createRegistrationLink(
    params: {
      tenantId: string;
      adminId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    tx?: DbTransactionLike,
  ): Promise<DeviceRegistrationLink>;
  findByTokenHashForUpdate(
    tokenHash: string,
    tx?: DbTransactionLike,
  ): Promise<DeviceRegistrationLink | null>;
  markUsed(
    params: {
      id: string;
      deviceId: string;
    },
    tx?: DbTransactionLike,
  ): Promise<void>;
}

export type DeviceRegistrationLinksRepo = DeviceRegistrationLinksRepository;

const cloneLink = (link: DeviceRegistrationLink): DeviceRegistrationLink => ({
  ...link,
  expiresAt: new Date(link.expiresAt),
  usedAt: link.usedAt ? new Date(link.usedAt) : null,
  createdAt: new Date(link.createdAt),
});

/**
 * In-memory implementation for tests and local development.
 * No locking is performed; findByTokenHashForUpdate behaves like a normal read.
 */
export class InMemoryDeviceRegistrationLinksRepository
  implements DeviceRegistrationLinksRepository
{
  private readonly byId = new Map<string, DeviceRegistrationLink>();
  private readonly byTokenHash = new Map<string, string>();

  createRegistrationLink(
    params: {
      tenantId: string;
      adminId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    _tx?: DbTransactionLike,
  ): Promise<DeviceRegistrationLink> {
    void _tx;
    if (this.byTokenHash.has(params.tokenHash)) {
      throw new Error("device_registration_links token_hash must be unique");
    }

    const createdAt = new Date();
    const link: DeviceRegistrationLink = {
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      tokenHash: params.tokenHash,
      expiresAt: new Date(params.expiresAt),
      usedAt: null,
      deviceId: null,
      createdByAdminId: params.adminId,
      createdAt,
    };

    this.byId.set(link.id, link);
    this.byTokenHash.set(link.tokenHash, link.id);

    return Promise.resolve(cloneLink(link));
  }

  findByTokenHashForUpdate(
    tokenHash: string,
    _tx?: DbTransactionLike,
  ): Promise<DeviceRegistrationLink | null> {
    void _tx;
    const id = this.byTokenHash.get(tokenHash);
    if (!id) {
      return Promise.resolve(null);
    }
    const link = this.byId.get(id);
    return Promise.resolve(link ? cloneLink(link) : null);
  }

  markUsed(
    params: {
      id: string;
      deviceId: string;
    },
    _tx?: DbTransactionLike,
  ): Promise<void> {
    void _tx;
    const link = this.byId.get(params.id);
    if (!link) {
      throw new Error("device_registration_links record not found");
    }
    link.usedAt = new Date();
    link.deviceId = params.deviceId;
    return Promise.resolve();
  }
}
