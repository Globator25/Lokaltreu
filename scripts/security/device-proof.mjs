#!/usr/bin/env node
// scripts/security/device-proof.mjs
import crypto from "node:crypto";
const base = process.env.SECURITY_API_BASE_URL || process.env.API_BASE || "http://127.0.0.1:4010";
const path = process.env.DEVICE_PROOF_PATH || "/referrals/link";
const method = process.env.DEVICE_PROOF_METHOD || "GET";
const url = new URL(path, base).toString();

const keyGood = process.env.DEVICE_KEY || "dev-test-key";
const keyBad = process.env.DEVICE_KEY_BAD || "dev-bad-key";

async function call(key) {
  const headers = { "x-device-key": key, authorization: `Bearer ${process.env.AUTH_TOKEN || "test-token"}` };
  const res = await fetch(url, { method, headers });
  return res.status;
}

const good = await call(keyGood);
const bad = await call("");
const skew = await call(keyBad);

console.log(JSON.stringify({ url, method, good, bad, skew }, null, 2));

const pass =
  good >= 200 && good < 300 &&
  ((bad >= 400 && bad < 500) || (skew >= 400 && skew < 500));

if (!pass) {
  process.exit(1);
}
