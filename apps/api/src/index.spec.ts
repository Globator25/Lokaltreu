import type http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";

import { startServer, healthPayload } from "./index";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = await startServer(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine listening address for test server");
  }
  const info = address as AddressInfo;
  baseUrl = `http://127.0.0.1:${info.port}`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

test("GET /health returns service status", async () => {
  const response = await fetch(`${baseUrl}/health`);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toStrictEqual(healthPayload);
});
