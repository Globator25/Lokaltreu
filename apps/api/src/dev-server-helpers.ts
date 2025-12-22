import http from "node:http";

export type DevResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export type EnvLike = Record<string, string | undefined>;

export function resolveDevPort(env: EnvLike = process.env): number {
  return Number(env.PORT ?? env.DEV_API_PORT ?? 4010);
}

const JSON_RESPONSE = JSON.stringify({ ok: true, stub: true });

function isHotRoute(method?: string, url?: string): boolean {
  return method === "POST" && (url === "/stamps/claim" || url === "/rewards/redeem");
}

export function buildDevResponse(method?: string, url?: string): DevResponse {
  if (method === "GET" && url === "/") {
    return {
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: "ok",
    };
  }

  if (isHotRoute(method, url)) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON_RESPONSE,
    };
  }

  return {
    statusCode: 404,
    headers: { "content-type": "text/plain" },
    body: "not found",
  };
}

export async function runDevServer(env: EnvLike = process.env): Promise<void> {
  try {
    const { resolveOtelConfig, startOtel } = await import("./observability/otel");
    void startOtel(resolveOtelConfig(), { autoRegisterSignals: false });
    console.warn("[dev-server] OTel initialized");
  } catch (error) {
    console.warn("[dev-server] OTel init skipped/failed (non-fatal)", error);
  }

  const port = resolveDevPort(env);
  const server = http.createServer((req, res) => {
    const response = buildDevResponse(req.method, req.url ?? undefined);
    res.writeHead(response.statusCode, response.headers);
    res.end(response.body);
  });

  server.listen(port, () => {
    console.warn(`[dev-server] listening on http://localhost:${port}`);
  });

  const shutdown = () => {
    console.warn("[dev-server] shutting down...");
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
