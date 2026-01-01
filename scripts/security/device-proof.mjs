#!/usr/bin/env node
// scripts/security/device-proof.mjs
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
const base = process.env.SECURITY_API_BASE_URL || process.env.API_BASE || "http://127.0.0.1:4010";
const path = process.env.SECURITY_PATH ?? process.env.DEVICE_PROOF_PATH ?? "/referrals/link";
const method = (process.env.SECURITY_METHOD ?? process.env.DEVICE_PROOF_METHOD ?? "GET").toUpperCase();
const url = new URL(path, base).toString();

const keyGood = process.env.DEVICE_KEY || "dev-test-key";
const keyBad = process.env.DEVICE_KEY_BAD || "dev-bad-key";
const headersFile = process.env.SECURITY_REQUEST_HEADERS_FILE;
const bodyFile = process.env.SECURITY_REQUEST_BODY_FILE;
const strictSkew = process.env.SECURITY_STRICT === "1";

async function loadJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

let requestBody;
let baseHeaders = { Authorization: `Bearer ${process.env.AUTH_TOKEN || "test-token"}` };
try {
  if (headersFile) {
    baseHeaders = { ...baseHeaders, ...(await loadJsonFile(headersFile)) };
  }
  if (bodyFile) {
    requestBody = await loadJsonFile(bodyFile);
  }
} catch {
  console.error(JSON.stringify({ path, method, statusCodes: [], exitCode: 2, error: "setup invalid" }));
  process.exit(2);
}

const defaultProof = baseHeaders["X-Device-Proof"] ?? "test-proof";

async function call({ key, timestamp }) {
  try {
    const headers = {
      ...baseHeaders,
      "X-Device-Key": key,
      "X-Device-Proof": defaultProof,
      "X-Device-Timestamp": String(timestamp),
    };
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

const now = Date.now();
const good = await call({ key: keyGood, timestamp: now });
const bad = await call({ key: keyBad, timestamp: now });
const skew = await call({ key: keyGood, timestamp: now - 120_000 });

console.log(JSON.stringify({ case: "good", status: good.status }));
console.log(JSON.stringify({ case: "bad", status: bad.status }));
console.log(JSON.stringify({ case: "skew", status: skew.status }));

const goodOk = good.status >= 200 && good.status < 300;
const badDifferentiated = bad.status >= 400 && bad.status < 500;
const skewDifferentiable = skew.status >= 400 && skew.status < 500;

if (!skewDifferentiable) {
  console.warn(JSON.stringify({ path, method, note: "skew not differentiable", strict: strictSkew }));
  if (strictSkew) {
    console.log(JSON.stringify({ path, method, exitCode: 1 }));
    process.exit(1);
  }
}

let exitCode = 0;
let note;

if (!goodOk) {
  exitCode = 1;
  note = "good request failed";
} else if (!badDifferentiated) {
  exitCode = strictSkew ? 1 : 2;
  note = "bad not differentiable";
} else {
  exitCode = 0;
}

console.log(JSON.stringify({ path, method, exitCode, note }));
process.exit(exitCode);
