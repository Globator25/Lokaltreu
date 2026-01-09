import { createServer } from "node:http";
import type { AdminAuthRequest } from "./mw/admin-auth.js";
import {
  handleCreateDsrRequest,
  handleFulfillDsrRequest,
  handleGetDsrRequest,
} from "./handlers/dsr.js";
import { InMemoryIdempotencyStore } from "./mw/idempotency.js";
import { InMemoryDeletedSubjectsRepository } from "./repositories/deleted-subjects-repo.js";
import { InMemoryDsrRequestRepository } from "./repositories/dsr-requests-repo.js";
import { createDsrService } from "./services/dsr-service.js";

export type DsrServerHandle = {
  server: ReturnType<typeof createServer>;
  baseUrl: string;
  dsrRepo: InMemoryDsrRequestRepository;
  tombstoneRepo: InMemoryDeletedSubjectsRepository;
  idempotencyStore: InMemoryIdempotencyStore;
};

export async function startDsrServer(): Promise<DsrServerHandle> {
  const dsrRepo = new InMemoryDsrRequestRepository();
  const tombstoneRepo = new InMemoryDeletedSubjectsRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();

  const dsrService = createDsrService({
    repo: dsrRepo,
    tombstoneRepo,
    transaction: { run: async <T>(fn: () => Promise<T>) => fn() },
    applyDeletion: async () => Promise.resolve(),
  });

  const readHeader = (req: import("node:http").IncomingMessage, name: string): string | undefined => {
    const value = req.headers[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return undefined;
  };

  const getTestTenant = (req: import("node:http").IncomingMessage) =>
    readHeader(req, "x-test-tenant-id") ?? "tenant-1";
  const shouldSkipContext = (req: import("node:http").IncomingMessage) =>
    readHeader(req, "x-test-no-context") === "1";

  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    const dsrRequestMatch = path.match(/^\/dsr\/requests\/([^/]+)$/);
    const dsrFulfillMatch = path.match(/^\/dsr\/requests\/([^/]+)\/fulfill$/);

    if (!shouldSkipContext(req)) {
      (req as AdminAuthRequest).context = {
        admin: {
          tenantId: getTestTenant(req),
          adminId: "admin-1",
          token: "test",
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        },
      };
    }

    if (req.method === "POST" && path === "/dsr/requests") {
      void handleCreateDsrRequest(req as AdminAuthRequest, res, {
        service: dsrService,
        idempotencyStore,
      });
      return;
    }
    if (req.method === "GET" && dsrRequestMatch) {
      void handleGetDsrRequest(req as AdminAuthRequest, res, {
        service: dsrService,
        idempotencyStore,
      }, dsrRequestMatch[1]);
      return;
    }
    if (req.method === "POST" && dsrFulfillMatch) {
      void handleFulfillDsrRequest(req as AdminAuthRequest, res, {
        service: dsrService,
        idempotencyStore,
      }, dsrFulfillMatch[1]);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    dsrRepo,
    tombstoneRepo,
    idempotencyStore,
  };
}
