// apps/api/src/modules/auth/device-repository.ts

export type DeviceRecord = {
  tenantId: string;
  deviceId: string;
  publicKey: string; // Base64url Ed25519 Public Key
  algorithm: "ed25519";
  enabled: boolean;
};

export interface DeviceRepository {
  findById(params: {
    tenantId: string;
    deviceId: string;
  }): Promise<DeviceRecord | null>;

  /**
   * Lookup by device key without explicit tenant context.
   * For MVP we treat deviceId as globally unique (deviceKey == deviceId).
   */
  findByKey(params: { deviceKey: string }): Promise<DeviceRecord | null>;
}

/**
 * Einfache In-Memory-Implementierung für Tests / lokale Entwicklung.
 * Später kann diese Implementierung durch eine DB-/ORM-Variante ersetzt werden.
 */
export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly devicesByKey = new Map<string, DeviceRecord>();

  private keyOf(tenantId: string, deviceId: string): string {
    return `${tenantId}:${deviceId}`;
  }

  upsert(device: DeviceRecord): void {
    const key = this.keyOf(device.tenantId, device.deviceId);
    this.devices.set(key, device);
    this.devicesByKey.set(device.deviceId, device);
  }

  // Nicht async, sondern explizit Promise zurückgeben → kein require-await-Verstoß
  findById(params: {
    tenantId: string;
    deviceId: string;
  }): Promise<DeviceRecord | null> {
    const key = this.keyOf(params.tenantId, params.deviceId);
    const record = this.devices.get(key) ?? null;
    return Promise.resolve(record);
  }

  findByKey(params: { deviceKey: string }): Promise<DeviceRecord | null> {
    return Promise.resolve(this.devicesByKey.get(params.deviceKey) ?? null);
  }
}
