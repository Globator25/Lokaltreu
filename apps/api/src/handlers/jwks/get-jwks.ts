// apps/api/src/handlers/jwks/get-jwks.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { getPublicJwks } from "../../auth/admin-jwt.js";
import { sendJson } from "../http-utils.js";

export function handleGetJwks(_req: IncomingMessage, res: ServerResponse) {
  const jwks = getPublicJwks();
  return sendJson(res, 200, jwks);
}
