#!/usr/bin/env node
// scripts/security/device-proof.mjs
import crypto from "node:crypto";
const base = process.env.API_BASE || "http://localhost:4010";
const url  = base + "/device-proof";
const priv = process.env.DP_PRIV || null;
const pub  = process.env.DP_PUB  || null;
function sign(payload){
  if(!priv) return "invalid-sig";
  const key = crypto.createPrivateKey({key:Buffer.from(priv,"base64"), format:"der", type:"pkcs8"});
  return crypto.sign(null, Buffer.from(payload), key).toString("base64");
}
async function call(sig, skew=0){
  const now = Math.floor(Date.now()/1000)+skew;
  const body = JSON.stringify({ ts: now, nonce: crypto.randomUUID(), pub });
  const headers = {"content-type":"application/json", "x-device-proof":sig, authorization:`Bearer ${process.env.AUTH_TOKEN||"test-token"}`};
  const r = await fetch(url, {method:"POST", headers, body}); return r.status;
}
const payload = "proof";
const good = await call(sign(payload), 0);
const bad  = await call("not-a-valid-signature", 0);
const skew = await call(sign(payload), 35);
console.log(JSON.stringify({good,bad,skew}, null, 2));
const ok = (good===200||good===201) && (bad===401||bad===403) && (skew===401||skew===403);
if(!ok) process.exit(1);
