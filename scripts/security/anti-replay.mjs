#!/usr/bin/env node
// scripts/security/anti-replay.mjs
const base = process.env.SECURITY_API_BASE_URL || process.env.API_BASE || "http://127.0.0.1:4010";
const path = process.env.ANTI_REPLAY_PATH || "/referrals/link";
const method = process.env.ANTI_REPLAY_METHOD || "GET";
const url = new URL(path, base).toString();

const headers = {
  authorization: `Bearer ${process.env.AUTH_TOKEN || "test-token"}`,
  "x-idempotency-key": "replay-" + Date.now(),
};

async function hit() {
  const res = await fetch(url, { method, headers });
  return res.status;
}

const results = await Promise.all(Array.from({ length: 10 }, hit));
const allSame = results.every((status) => status === results[0]);
const withinRange = results.every((status) => status >= 200 && status < 500);

const report = { url, method, results };
console.log(JSON.stringify(report, null, 2));

if (!allSame || !withinRange) {
  process.exit(1);
}
