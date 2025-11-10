#!/usr/bin/env node
// scripts/security/plan-gate.mjs
const base = process.env.API_BASE || "http://localhost:4010";
const r = await fetch(base + "/referrals", {
  method:"POST",
  headers:{ "content-type":"application/json", authorization:`Bearer ${process.env.STARTER_TOKEN||process.env.AUTH_TOKEN||"starter"}` },
  body: JSON.stringify({ partnerId:"x" })
});
let body = {};
try { body = await r.json(); } catch {}
console.log(JSON.stringify({status:r.status, body}, null, 2));
if (r.status !== 403 || !String(body.code||"").includes("PLAN_NOT_ALLOWED")) process.exit(1);
