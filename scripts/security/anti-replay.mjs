#!/usr/bin/env node
// scripts/security/anti-replay.mjs
const base = process.env.API_BASE || "http://localhost:4010";
const url  = base + "/claims";
const idemKey = "replay-" + Date.now();
const headers = {
  "content-type":"application/json",
  "x-idempotency-key": idemKey,
  authorization: `Bearer ${process.env.AUTH_TOKEN || "test-token"}`
};
const body = JSON.stringify({ amount:123, currency:"EUR" });
async function hit(){ const r = await fetch(url, {method:"POST", headers, body}); return r.status; }
const results = await Promise.all(Array.from({length:10}, hit));
const ok201 = results.filter(s=>s===201).length===1;
const ok409 = results.filter(s=>s===409).length===9;
console.log(JSON.stringify({results}, null, 2));
if(!(ok201 && ok409)){ console.error("Anti-Replay expectations not met"); process.exit(1); }
