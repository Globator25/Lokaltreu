#!/usr/bin/env node
// scripts/security/plan-gate.mjs
// Prism static hint: set PRISM_PREFERRED_STATUS=403 to add `Prefer: code=403` header (if supported by Prism).
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.PRISM_BASE_URL ?? "http://127.0.0.1:4010";
const joinUrl = (base, path) => `${base.replace(/\/+$/u, "")}/${String(path).replace(/^\/+/, "")}`;
const preferredStatus = process.env.PRISM_PREFERRED_STATUS;

console.log(`[plan-gate] baseUrl=${BASE_URL}`);

const headers = {
  "content-type": "application/json",
  "x-device-proof": "stub-proof",
  "x-device-key": process.env.DEVICE_KEY || "mock-device-key",
  "Idempotency-Key": randomUUID(),
  authorization: `Bearer ${process.env.STARTER_TOKEN || process.env.AUTH_TOKEN || "starter"}`,
};

if (preferredStatus) {
  headers.Prefer = `code=${preferredStatus}`;
}

let r;
try {
  r = await fetch(joinUrl(BASE_URL, "/rewards/redeem"), {
    method: "POST",
    headers,
    body: JSON.stringify({ redeemToken: "stub", plan_gate_mode: "PLAN_GATE" }),
  });
} catch (err) {
  console.error(`[plan-gate] baseUrl not reachable: ${BASE_URL}`);
  process.exit(1);
}

let body = null;
try {
  body = await r.json();
} catch {}

const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const errorCode = isRecord(body) ? String(body.error_code || "") : "";

if (r.status === 403 && errorCode.includes("PLAN_NOT_ALLOWED")) {
  process.exit(0);
}

console.log(JSON.stringify({ status: r.status, body }, null, 2));
process.exit(1);
