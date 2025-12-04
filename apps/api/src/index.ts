import http from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? "", 10) || 4010;

export type ApiServer = http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;

export const healthPayload = {
  status: "ok",
  service: "lokaltreu-api",
};

export function isMainModule(meta: ImportMeta): boolean {
  if (!meta?.url) return false;
  const executedFile = process.argv[1];
  if (!executedFile) return false;
  return fileURLToPath(meta.url) === executedFile;
}

/**
 * Creates a simple HTTP server that exposes a GET /health endpoint.
 */
export function createServer(): ApiServer {
  return http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify(healthPayload));
      return;
    }

    res.writeHead(404);
    res.end(
      JSON.stringify({
        status: "error",
        message: "Not Found",
      }),
    );
  });
}

export async function startServer(port = DEFAULT_PORT): Promise<ApiServer> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.listen(port, resolve);
    server.once("error", reject);
  });

  return server;
}

function describeAddress(address: string | AddressInfo | null): string {
  if (!address) return "unknown";
  if (typeof address === "string") return address;
  return `http://localhost:${address.port}`;
}

if (isMainModule(import.meta)) {
  startServer()
    .then((server) => {
      const address = server.address();
      console.log(`API ready on ${describeAddress(address)}`);
    })
    .catch((error) => {
      console.error("Failed to start API server", error);
      process.exitCode = 1;
    });
}
