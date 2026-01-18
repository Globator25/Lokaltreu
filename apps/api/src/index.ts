// Minimaler HTTP-Server für Admin-Auth (Schritt 14).
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { handleAdminLogin } from "./handlers/admins/login.js";
import { handleAdminLogout } from "./handlers/admins/logout.js";
import { handleAdminRefresh } from "./handlers/admins/refresh.js";
import { handleAdminRegister } from "./handlers/admins/register.js";
import { handleDeviceRegistrationConfirm } from "./handlers/devices/register-confirm.js";
import { handleDeviceRegistrationLinks } from "./handlers/devices/registration-links.js";
import {
  handleCreateDsrRequest,
  handleFulfillDsrRequest,
  handleGetDsrRequest,
} from "./handlers/dsr.js";
import { handleGetJwks } from "./handlers/jwks/get-jwks.js";
import { handleGetReferralLink } from "./handlers/referrals/link.js";
import { handleRewardRedeem } from "./handlers/rewards/redeem.js";
import { handleReportingSummary } from "./handlers/reporting/summary.js";
import { handleReportingTimeseries } from "./handlers/reporting/timeseries.js";
import { handleStampClaim } from "./handlers/stamps/claim.js";
import { handleStampTokens } from "./handlers/stamps/tokens.js";
import type { AdminSession, AdminSessionStore, AuditEvent, AuditSink } from "./handlers/admins/types.js";
import { isRecord, problem, readJsonBody, sendProblem } from "./handlers/http-utils.js";
import { requireAdminAuth } from "./mw/admin-auth.js";
import { createDeviceAuthMiddleware } from "./middleware/device-auth.js";
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "./mw/idempotency.js";
import { requirePlanFeature as requirePlanFeatureGate } from "./mw/plan-gate.js";
import { createRateLimitMiddleware, InMemoryRateLimitStore } from "./mw/rate-limit.js";
import { InMemoryDeviceReplayStore } from "./modules/auth/device-replay-store.js";
import { InMemoryDeviceRepository } from "./modules/auth/device-repository.js";
import type { DbClientLike } from "./modules/devices/deviceRegistrationLinks.repo.js";
import { InMemoryRewardReplayStore } from "./modules/rewards/reward-replay-store.js";
import { createRewardService, InMemoryRewardCardStateStore, InMemoryRewardTokenStore } from "./modules/rewards/reward.service.js";
import { createStampService, InMemoryCardStateStore, InMemoryStampTokenStore } from "./modules/stamps/stamp.service.js";
import { createRedisIdempotencyStore } from "./services/idempotencyStore/redis.js";
import { InMemoryReferralRepository } from "./repositories/referrals.repo.js";
import { createDbReferralRepository } from "./repositories/referrals.db.js";
import { InMemoryTenantPlanStore, resolveTenantPlan } from "./services/plan-gate.js";
import { createReferralService } from "./services/referrals.service.js";
import { createPlanUsageTracker, InMemoryActiveDeviceStore } from "./plan/plan-policy.js";
import { InMemoryDeletedSubjectsRepository, createDbDeletedSubjectsRepository } from "./repositories/deleted-subjects-repo.js";
import { InMemoryDsrRequestRepository, createDbDsrRequestRepository } from "./repositories/dsr-requests-repo.js";
import { createDsrService } from "./services/dsr-service.js";
import { createReportingService, InMemoryReportingStore, type ReportingStore } from "./modules/reporting/reporting.service.js";
import {
  InMemoryWormAuditWriter,
  createDbWormAuditWriter,
  type WormAuditWriter,
} from "./modules/audit/worm/worm-writer.js";

type DeviceRegistrationLinkRow = {
  id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  device_id: string | null;
  created_by_admin_id: string | null;
  created_at: Date;
};

function createInMemoryDeviceRegistrationLinksDbClient(): DbClientLike {
  const rowsById = new Map<string, DeviceRegistrationLinkRow>();
  const idByTokenHash = new Map<string, string>();

  return {
    query<T = unknown>(sql: string, params?: unknown[]) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      if (normalized === "BEGIN" || normalized === "COMMIT" || normalized === "ROLLBACK") {
        return Promise.resolve({ rows: [] as T[], rowCount: 0 });
      }

      if (normalized.startsWith("INSERT INTO device_registration_links")) {
        const [id, tenantId, tokenHash, expiresAt, adminId] = params as [
          string,
          string,
          string,
          Date,
          string | null,
        ];

        const row: DeviceRegistrationLinkRow = {
          id,
          tenant_id: tenantId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          used_at: null,
          device_id: null,
          created_by_admin_id: adminId ?? null,
          created_at: new Date(),
        };

        rowsById.set(id, row);
        idByTokenHash.set(tokenHash, id);
        return Promise.resolve({ rows: [row] as T[], rowCount: 1 });
      }

      if (
        normalized.startsWith("SELECT") &&
        normalized.includes("FROM device_registration_links") &&
        normalized.includes("WHERE token_hash = $1")
      ) {
        const tokenHash = params?.[0] as string;
        const id = idByTokenHash.get(tokenHash);
        if (!id) {
          return Promise.resolve({ rows: [] as T[], rowCount: 0 });
        }
        const row = rowsById.get(id);
        return Promise.resolve(
          row
            ? { rows: [row] as T[], rowCount: 1 }
            : { rows: [] as T[], rowCount: 0 },
        );
      }

      if (
        normalized.startsWith("UPDATE device_registration_links") &&
        normalized.includes("SET used_at = now(), device_id = $2") &&
        normalized.includes("WHERE id = $1") &&
        normalized.includes("used_at IS NULL")
      ) {
        const [id, deviceId] = params as [string, string];
        const row = rowsById.get(id);
        if (!row || row.used_at) {
          return Promise.resolve({ rows: [] as T[], rowCount: 0 });
        }
        row.used_at = new Date();
        row.device_id = deviceId;
        return Promise.resolve({ rows: [] as T[], rowCount: 1 });
      }

      throw new Error(`Unexpected SQL in in-memory DB: ${normalized}`);
    },
  };
}

function requireTenantId(value: unknown, isProdLike: boolean): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (isProdLike) {
    throw new Error("tenant_id is required for audit");
  }
  return "system";
}

class InMemoryAdminSessionStore implements AdminSessionStore {
  private readonly sessions = new Map<string, AdminSession>();

  create(session: AdminSession): void {
    this.sessions.set(session.refreshTokenHash, session);
  }

  findByHash(refreshTokenHash: string): AdminSession | undefined {
    return this.sessions.get(refreshTokenHash);
  }

  rotate(refreshTokenHash: string, next: AdminSession): void {
    const existing = this.sessions.get(refreshTokenHash);
    if (existing) {
      existing.revokedAt = Date.now();
      existing.rotatedAt = Date.now();
    }
    this.sessions.set(next.refreshTokenHash, next);
  }

  revoke(refreshTokenHash: string): void {
    const existing = this.sessions.get(refreshTokenHash);
    if (existing) {
      existing.revokedAt = Date.now();
    }
  }
}

function mapAuditEventToWormInput(event: AuditEvent) {
  return {
    tenantId: event.tenantId,
    ts: new Date(event.at),
    action: event.event,
    result: "SUCCESS",
    deviceId: event.deviceId,
    cardId: event.cardId,
    jti: event.jti,
    correlationId: event.correlationId,
  };
}

class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  constructor(
    private readonly wormWriter: WormAuditWriter,
    private readonly reportingStore?: ReportingStore,
  ) {}

  async audit(event: AuditEvent): Promise<void> {
    this.events.push(event);
    this.reportingStore?.recordEvent({
      tenantId: event.tenantId,
      event: event.event,
      at: event.at,
      subjectId: typeof event.cardId === "string" ? event.cardId : undefined,
    });
    await this.wormWriter.write(mapAuditEventToWormInput(event));
  }
}

async function seedDevDevice(repo: InMemoryDeviceRepository): Promise<void> {
  const shouldSeed =
    (process.env.API_PROFILE === "dev" || process.env.API_PROFILE === "test") &&
    process.env.DEV_SEED === "1";
  if (!shouldSeed) {
    return;
  }
  const tenantId = process.env.DEV_DEVICE_SEED_TENANT_ID || "tenant-1";
  const deviceId = process.env.DEV_DEVICE_SEED_DEVICE_ID || "dev-seed-device";
  const seededPrivateKey = process.env.DEV_DEVICE_SEED_PRIVATE_KEY;
  let publicKey = process.env.DEV_DEVICE_SEED_PUBLIC_KEY;
  if (!publicKey && seededPrivateKey) {
    try {
      // libsodium private keys include the public key in the last 32 bytes.
      const raw = Buffer.from(seededPrivateKey, "base64");
      if (raw.length >= 64) {
        publicKey = raw.subarray(raw.length - 32).toString("base64");
      }
    } catch {
      publicKey = undefined;
    }
  }
  if (!publicKey) {
    publicKey = "hO5j3HEAEMA3cRhO0x0LrCOrQ0L1z4fMcdCjvtQ+Rys=";
  }
  const existing = await repo.findById({ tenantId, deviceId });
  if (existing && existing.enabled && existing.publicKey === publicKey) {
    console.warn(`DEV_SEED device already present for ${tenantId}/${deviceId}`);
    return;
  }
  repo.upsert({
    tenantId,
    deviceId,
    publicKey,
    algorithm: "ed25519",
    enabled: true,
  });
  console.warn(`DEV_SEED applied for ${tenantId}/${deviceId}`);
}

export function createAppServer() {
  const sessionStore = new InMemoryAdminSessionStore();
  const isProdLike = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
  const dbClient: DbClientLike = isProdLike
    ? {
        query(sql, params) {
          void sql;
          void params;
          return Promise.reject(new Error("Database client not configured"));
        },
      }
    : createInMemoryDeviceRegistrationLinksDbClient();
  const transactionRunner = {
    run: async <T>(fn: () => Promise<T>) => {
      await dbClient.query("BEGIN");
      try {
        const result = await fn();
        await dbClient.query("COMMIT");
        return result;
      } catch (error) {
        await dbClient.query("ROLLBACK");
        throw error;
      }
    },
  };
  const wormWriter = isProdLike
    ? createDbWormAuditWriter({ db: dbClient, transaction: transactionRunner, logger: console })
    : new InMemoryWormAuditWriter();
  const reportingStore = new InMemoryReportingStore();
  const auditSink = new InMemoryAuditSink(wormWriter, reportingStore);
  const deviceRepository = new InMemoryDeviceRepository();
  const replayStore = new InMemoryDeviceReplayStore();
  void seedDevDevice(deviceRepository);
  const deviceAuth = createDeviceAuthMiddleware({ deviceRepository, replayStore });
  const stampTokenStore = new InMemoryStampTokenStore();
  const cardStateStore = new InMemoryCardStateStore();
  const stampService = createStampService({ tokenStore: stampTokenStore, cardStore: cardStateStore, logger: console });
  const rewardTokenStore = new InMemoryRewardTokenStore();
  const rewardCardStore = new InMemoryRewardCardStateStore();
  const rewardReplayStore = new InMemoryRewardReplayStore();
  const rewardService = createRewardService({
    tokenStore: rewardTokenStore,
    cardStore: rewardCardStore,
    replayStore: rewardReplayStore,
    transaction: transactionRunner,
    logger: console,
    audit: {
      log: (event, payload) => {
        const tenantId = requireTenantId(payload.tenant_id, isProdLike);
        return Promise.resolve(auditSink.audit({
          event,
          tenantId,
          deviceId: typeof payload.device_id === "string" ? payload.device_id : undefined,
          cardId: typeof payload.card_id === "string" ? payload.card_id : undefined,
          correlationId: "n/a",
          at: Date.now(),
        } as AuditEvent));
      },
    },
  });
  const idempotencyStore = isProdLike ? createRedisIdempotencyStore() : new InMemoryIdempotencyStore();
  // TODO: Wire Redis-backed rate limit store when available.
  const rateLimitStore = new InMemoryRateLimitStore();
  const idempotency = createIdempotencyMiddleware(idempotencyStore);
  const rateLimit = createRateLimitMiddleware(rateLimitStore);

  const planStore = new InMemoryTenantPlanStore();
  const activeDeviceStore = new InMemoryActiveDeviceStore();
  const dsrRequestRepo = isProdLike
    ? createDbDsrRequestRepository(dbClient)
    : new InMemoryDsrRequestRepository();
  const deletedSubjectsRepo = isProdLike
    ? createDbDeletedSubjectsRepository(dbClient)
    : new InMemoryDeletedSubjectsRepository();
  const reportingService = createReportingService({
    store: reportingStore,
    planStore,
    activeDeviceStore,
    tombstoneRepo: deletedSubjectsRepo,
  });
  const planUsageTracker = createPlanUsageTracker({ planStore });
  const planUsage = {
    recordStamp: async (params: { tenantId: string; correlationId: string }) => {
      const plan = resolveTenantPlan(await planStore.getPlan(params.tenantId));
      const usage = await planUsageTracker.recordStamp({
        tenantId: params.tenantId,
        plan,
        correlationId: params.correlationId,
      });
      if (!usage) {
        return;
      }
      const threshold = usage.threshold;
      if (!threshold || !usage.shouldNotify) {
        return;
      }
      const event =
        threshold === 100 ? "plan.limit.upgrade_signal_emitted" : "plan.limit.warning_emitted";
      await Promise.resolve(auditSink.audit({
        event,
        tenantId: params.tenantId,
        correlationId: params.correlationId,
        meta: {
          usage_percent: usage.usagePercent,
          threshold,
          plan_code: plan,
        },
        at: Date.now(),
      }));
      console.warn("plan limit signal emitted", {
        tenant_id: params.tenantId,
        correlation_id: params.correlationId,
        usage_percent: usage.usagePercent,
        threshold,
        plan_code: plan,
      });
    },
  };
  const referralRepo = isProdLike ? createDbReferralRepository(dbClient) : new InMemoryReferralRepository();
  const referralService = createReferralService({
    repo: referralRepo,
    planStore,
    logger: console,
    audit: {
      log: (event, payload) => {
        const tenantId = requireTenantId(payload.tenant_id, isProdLike);
        return Promise.resolve(auditSink.audit({
          event,
          tenantId,
          deviceId: typeof payload.device_id === "string" ? payload.device_id : undefined,
          cardId:
            typeof payload.referred_card_id === "string"
              ? payload.referred_card_id
              : typeof payload.referrer_card_id === "string"
                ? payload.referrer_card_id
                : typeof payload.card_id === "string"
                  ? payload.card_id
                  : undefined,
          correlationId: "n/a",
          at: Date.now(),
        } as AuditEvent));
      },
    },
  });

  const dsrService = createDsrService({
    repo: dsrRequestRepo,
    tombstoneRepo: deletedSubjectsRepo,
    transaction: transactionRunner,
    applyDeletion: (params) => {
      console.warn("dsr deletion applied", {
        tenant_id: params.tenantId,
        subject_id: params.subjectId,
        correlation_id: params.correlationId,
        action: params.action,
      });
      return Promise.resolve();
    },
    logger: console,
  });

  const stampServiceWithReferrals = createStampService({
    tokenStore: stampTokenStore,
    cardStore: cardStateStore,
    logger: console,
    transaction: transactionRunner,
    referrals: referralService,
    planStore,
    planUsage,
    audit: {
      log: (event, payload) => {
        const tenantId = requireTenantId(payload.tenantId, isProdLike);
        return Promise.resolve(auditSink.audit({
          event,
          tenantId,
          deviceId: typeof payload.deviceId === "string" ? payload.deviceId : undefined,
          cardId: typeof payload.cardId === "string" ? payload.cardId : undefined,
          correlationId: "n/a",
          at: Date.now(),
        } as AuditEvent));
      },
    },
  });

  async function requireDeviceAuth(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ): Promise<boolean> {
    let allowed = false;
    await deviceAuth(req, res, () => {
      allowed = true;
    });
    return allowed;
  }

  async function requireAdmin(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ): Promise<boolean> {
    let allowed = false;
    await requireAdminAuth(req, res).then((ok) => {
      allowed = ok;
    });
    return allowed;
  }

  async function requireRateLimit(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ): Promise<boolean> {
    let allowed = false;
    await rateLimit(req, res).then((ok) => {
      allowed = ok;
    });
    return allowed;
  }

  async function requireIdempotency(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ): Promise<boolean> {
    let allowed = false;
    await idempotency(req, res).then((ok) => {
      allowed = ok;
    });
    return allowed;
  }

  async function handleRequest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ) {
    try {
      const path = req.url?.split("?")[0] ?? "/";
      const dsrRequestMatch = path.match(/^\/dsr\/requests\/([^/]+)$/);
      const dsrFulfillMatch = path.match(/^\/dsr\/requests\/([^/]+)\/fulfill$/);
      const isClaimRoute = req.method === "POST" && path === "/stamps/claim";
      const isRedeemRoute = req.method === "POST" && path === "/rewards/redeem";
      const isHotRoute = isClaimRoute || isRedeemRoute;

      if (req.method === "GET" && (path === "/health" || path === "/ready")) {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ status: path === "/ready" ? "ready" : "ok" }));
        return;
      }

      if (isHotRoute) {
        if (req.headers["content-type"]?.includes("application/json") && !("body" in req)) {
          (req as { body?: unknown }).body = await readJsonBody(req);
        }
      }

      const requiresDeviceAuth =
        req.method === "POST" && (path === "/stamps/tokens" || isRedeemRoute);
      if (requiresDeviceAuth) {
        if (isRedeemRoute) {
          const body = (req as { body?: unknown }).body;
          if (!isRecord(body) || typeof body.redeemToken !== "string") {
            sendProblem(res, problem(400, "Bad Request", "Missing redeemToken", req.url ?? "/rewards/redeem"));
            return;
          }
        }
        if (path === "/stamps/tokens" && typeof req.headers.authorization === "string") {
          const allowed = await requireAdmin(req, res);
          if (!allowed) {
            return;
          }
        } else {
          const allowed = await requireDeviceAuth(req, res);
          if (!allowed) {
            return;
          }
        }
      }

      if (isClaimRoute) {
        const idemOk = await requireIdempotency(req, res);
        if (!idemOk) {
          return;
        }
      }

      const isRateLimitedPath = req.method === "POST" && (isClaimRoute || isRedeemRoute);
      if (isRateLimitedPath) {
        const rateOk = await requireRateLimit(req, res);
        if (!rateOk) {
          return;
        }
      }

      if (isRedeemRoute) {
        const idemOk = await requireIdempotency(req, res);
        if (!idemOk) {
          return;
        }
      }
      if (req.method === "POST" && path === "/admins/login") {
        await handleAdminLogin(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/admins/register") {
        await handleAdminRegister(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/admins/refresh") {
        await handleAdminRefresh(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/admins/logout") {
        await handleAdminLogout(req, res, { sessionStore, auditSink });
        return;
      }
      if (req.method === "POST" && path === "/dsr/requests") {
        const allowed = await requireAdmin(req, res);
        if (!allowed) {
          return;
        }
        await handleCreateDsrRequest(req, res, {
          service: dsrService,
          idempotencyStore,
          logger: console,
        });
        return;
      }
      if (req.method === "GET" && dsrRequestMatch) {
        const allowed = await requireAdmin(req, res);
        if (!allowed) {
          return;
        }
        await handleGetDsrRequest(req, res, {
          service: dsrService,
          idempotencyStore,
          logger: console,
        }, dsrRequestMatch[1]);
        return;
      }
      if (req.method === "POST" && dsrFulfillMatch) {
        const allowed = await requireAdmin(req, res);
        if (!allowed) {
          return;
        }
        await handleFulfillDsrRequest(req, res, {
          service: dsrService,
          idempotencyStore,
          logger: console,
        }, dsrFulfillMatch[1]);
        return;
      }
      if (req.method === "POST" && path === "/devices/registration-links") {
        const allowed = await requireAdmin(req, res);
        if (!allowed) {
          return;
        }
        await handleDeviceRegistrationLinks(req, res, {
          db: dbClient,
          idempotencyStore,
          logger: console,
        });
        return;
      }
      if (req.method === "POST" && path === "/devices/register/confirm") {
        await handleDeviceRegistrationConfirm(req, res, {
          db: dbClient,
          logger: console,
          planStore,
          activeDeviceStore,
        });
        return;
      }
      if (req.method === "POST" && path === "/stamps/tokens") {
        await handleStampTokens(req, res, {
          service: stampService,
          idempotencyStore,
          logger: console,
        });
        return;
      }
      if (req.method === "POST" && path === "/stamps/claim") {
        await handleStampClaim(req, res, {
          service: stampServiceWithReferrals,
          logger: console,
        });
        return;
      }
      if (req.method === "GET" && path === "/referrals/link") {
        const planOk = await requirePlanFeatureGate(req, res, { planStore, logger: console }, "referrals");
        if (!planOk) {
          return;
        }
        await handleGetReferralLink(req, res, {
          service: referralService,
          logger: console,
        });
        return;
      }
      if (req.method === "GET" && path === "/admins/reporting/summary") {
        const allowed = await requireAdmin(req, res);
        if (!allowed) {
          return;
        }
        await handleReportingSummary(req, res, {
          service: reportingService,
        });
        return;
      }
      if (req.method === "GET" && path === "/admins/reporting/timeseries") {
        const allowed = await requireAdmin(req, res);
        if (!allowed) {
          return;
        }
        await handleReportingTimeseries(req, res, {
          service: reportingService,
        });
        return;
      }
      if (req.method === "POST" && path === "/rewards/redeem") {
        await handleRewardRedeem(req, res, {
          service: rewardService,
          logger: console,
        });
        return;
      }
      if (req.method === "GET" && path === "/.well-known/jwks.json") {
        handleGetJwks(req, res);
        return;
      }

      // Unknown route: return a generic RFC 7807 problem (no domain-specific error_code).
      sendProblem(
        res,
        problem(404, "Not Found", "Route not found", req.url ?? "/")
      );
    } catch (error) {
      // Unexpected error: log without PII and return a generic RFC 7807 problem (no domain-specific error_code).
      console.error("Unhandled error", error instanceof Error ? error.message : error);
      sendProblem(
        res,
        problem(500, "Internal Server Error", "Unexpected error", req.url ?? "/")
      );
    }
  }

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  return { server, auditSink, sessionStore };
}

export async function startServer(port: number) {
  const { server } = createAppServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    const maybeServer = server as typeof server & {
      once?: (event: string, listener: (error: Error) => void) => void;
      off?: (event: string, listener: (error: Error) => void) => void;
    };
    const onError = (error: Error) => {
      if (typeof maybeServer.off === "function") {
        maybeServer.off("error", onError);
      }
      rejectListen(error);
    };

    if (typeof maybeServer.once === "function") {
      maybeServer.once("error", onError);
    }

    try {
      server.listen(port, () => {
        if (typeof maybeServer.off === "function") {
          maybeServer.off("error", onError);
        }
        resolveListen();
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Failed to start server"));
    }
  });
  return server;
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  startServer(port)
    .then(() => {
      console.warn("Lokaltreu API startet...");
    })
    .catch((err) => {
      console.error("Failed to start Lokaltreu API", err);
      process.exit(1);
    });
}
