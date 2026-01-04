#!/usr/bin/env node
// scripts/security/anti-replay.mjs
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = process.env.SECURITY_API_BASE_URL || process.env.API_BASE || "http://127.0.0.1:4010";
const path = process.env.SECURITY_PATH ?? process.env.ANTI_REPLAY_PATH ?? "/referrals/link";
const method = (process.env.SECURITY_METHOD ?? process.env.ANTI_REPLAY_METHOD ?? "GET").toUpperCase();
const url = new URL(path, base).toString();

/*
 * ENV:
 * - SECURITY_API_BASE_URL: Ziel-Base-URL (Default wie gehabt).
 * - SECURITY_METHOD / SECURITY_PATH: Request-Target-Overrides (fallback auf ANTI_REPLAY_*).
 * - SECURITY_REQUEST_BODY_FILE / SECURITY_REQUEST_HEADERS_FILE: JSON-Body/Headers laden, optional.
 * ExitCodes: 0=Gate bestanden, 1=Gate verletzt/unerwarteter Fehler, 2=Setup ungueltig/nicht aussagekraeftig.
 */

const headers = {
  authorization: `Bearer ${process.env.AUTH_TOKEN || "test-token"}`,
};

const bodyFile = process.env.SECURITY_REQUEST_BODY_FILE;
const headersFile = process.env.SECURITY_REQUEST_HEADERS_FILE;
const idempotencyEnv = process.env.SECURITY_IDEMPOTENCY_KEY;

async function loadJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function ensureIdempotencyKey(value) {
  const key = (value || `replay-${randomUUID()}`).toString();
  if (key.length < 8) {
    throw new Error("Idempotency-Key must be at least 8 characters.");
  }
  return key;
}

let requestBody;
try {
  if (headersFile) {
    Object.assign(headers, await loadJsonFile(headersFile));
  }
  if (bodyFile) {
    requestBody = await loadJsonFile(bodyFile);
  }
  headers["Idempotency-Key"] = ensureIdempotencyKey(idempotencyEnv || headers["Idempotency-Key"]);
} catch (err) {
  console.error(JSON.stringify({ path, method, statusCodes: [], exitCode: 2, error: "setup invalid" }));
  process.exit(2);
}

async function hit() {
  try {
    const req = { method, headers };
    if (requestBody !== undefined && method !== "GET" && method !== "HEAD") {
      req.body = JSON.stringify(requestBody);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
    const res = await fetch(url, req);
    const status = res.status;
    const text = await res.text();
    if (
      status === 422 ||
      text.includes("request not OpenAPI-valid") ||
      text.includes("OpenAPI-valid")
    ) {
      console.error("SETUP_INVALID: request not OpenAPI-valid");
      process.exit(2);
    }
    return { status, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Request with GET/HEAD method cannot have body.")) {
      console.error("SETUP_INVALID: attempted to send body with GET/HEAD");
      process.exit(2);
    }
    console.error("REQUEST_FAILED");
    process.exit(1);
  }
}

const results = await Promise.all(Array.from({ length: 10 }, hit));
const statusCodes = results.map((result) => result.status);
const allSame = statusCodes.every((status) => status === statusCodes[0]);
const withinRange = statusCodes.every((status) => status >= 200 && status < 500);
const setupInvalid = results.some(
  (result) => result.status === 422 || result.text.includes("request not OpenAPI-valid")
);

const exitCode = setupInvalid ? 2 : allSame && withinRange ? 0 : 1;
console.log(JSON.stringify({ path, method, statusCodes, exitCode }));
process.exit(exitCode);
