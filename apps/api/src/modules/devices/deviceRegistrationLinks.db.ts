import crypto from "node:crypto";
import type {
  DeviceRegistrationLink,
  DeviceRegistrationLinksRepository,
  DbClientLike,
  DbTransactionLike,
} from "./deviceRegistrationLinks.repo.js";

interface DeviceRegistrationLinkRow {
  id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: string | Date;
  used_at: string | Date | null;
  device_id: string | null;
  created_by_admin_id: string | null;
  created_at: string | Date;
}

const mapRowToLink = (row: DeviceRegistrationLinkRow): DeviceRegistrationLink => ({
  id: row.id,
  tenantId: row.tenant_id,
  tokenHash: row.token_hash,
  expiresAt: new Date(row.expires_at),
  usedAt: row.used_at ? new Date(row.used_at) : null,
  deviceId: row.device_id,
  createdByAdminId: row.created_by_admin_id,
  createdAt: new Date(row.created_at),
});

const getClient = (db: DbClientLike, tx?: DbTransactionLike): DbClientLike =>
  (tx ?? db);

/**
 * DB-backed implementation for device_registration_links (Step 18).
 * Erwartet einen DbClientLike mit .query(sql, params).
 */
export const createDbDeviceRegistrationLinksRepository = (
  db: DbClientLike,
): DeviceRegistrationLinksRepository => ({
  async createRegistrationLink(params, tx) {
    const client = getClient(db, tx);
    const id = crypto.randomUUID();

    const result = await client.query<DeviceRegistrationLinkRow>(
      `
      INSERT INTO device_registration_links (
        id,
        tenant_id,
        token_hash,
        expires_at,
        device_id,
        created_by_admin_id
      )
      VALUES ($1, $2, $3, $4, NULL, $5)
      RETURNING
        id,
        tenant_id,
        token_hash,
        expires_at,
        used_at,
        device_id,
        created_by_admin_id,
        created_at
      `,
      [id, params.tenantId, params.tokenHash, params.expiresAt, params.adminId],
    );

    return mapRowToLink(result.rows[0]);
  },

  async findByTokenHashForUpdate(tokenHash, tx) {
    const client = getClient(db, tx);

    const result = await client.query<DeviceRegistrationLinkRow>(
      `
      SELECT
        id,
        tenant_id,
        token_hash,
        expires_at,
        used_at,
        device_id,
        created_by_admin_id,
        created_at
      FROM device_registration_links
      WHERE token_hash = $1
      FOR UPDATE
      `,
      [tokenHash],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRowToLink(result.rows[0]);
  },

  async markUsed(params, tx) {
    const client = getClient(db, tx);

    const result = await client.query<DeviceRegistrationLinkRow>(
      `
      UPDATE device_registration_links
      SET used_at = now(), device_id = $2
      WHERE id = $1 AND used_at IS NULL
      `,
      [params.id, params.deviceId],
    );

    if (result.rowCount === 0) {
      // Bereits verwendet oder nicht gefunden – aus Service-Sicht ein Fehler.
      throw new Error("device_registration_links record not found or already used");
    }
  },
});
