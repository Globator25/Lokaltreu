import http from "http";
import url from "url";
import { createPublicKey, verify } from "node:crypto";

const seen = new Set();
const DEFAULT_DEVICE_PROOF_PUB = "MCowBQYDK2VwAyEAE2OnB/P0NYRSNEBU+TOqE+MW/hwb01U05UXUkeVGtKI=";
const argv = process.argv.slice(2);

function consumeFlag(flag) {
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === flag) {
      const next = argv[i + 1];
      argv.splice(i, next ? 2 : 1);
      return next ?? true;
    }
    if (value?.startsWith?.(`${flag}=`)) {
      argv.splice(i, 1);
      return value.slice(flag.length + 1);
    }
  }
  return undefined;
}

const PORT = Number(process.env.PORT ?? consumeFlag("--port") ?? 3000) || 3000;
const PROFILE = consumeFlag("--profile");
if (PROFILE && typeof PROFILE === "string" && !process.env.PROFILE) {
  process.env.PROFILE = PROFILE;
}
let cachedPublicKeySource;
let cachedPublicKey;

function problem(res, code, type) {
  res.writeHead(code, { "Content-Type": "application/problem+json" });
  res.end(JSON.stringify({ type }));
}

function loadDevicePublicKey() {
  const source = process.env.DP_PUB || DEFAULT_DEVICE_PROOF_PUB;
  if (cachedPublicKey && cachedPublicKeySource === source) {
    return cachedPublicKey;
  }
  try {
    const der = Buffer.from(source, "base64");
    cachedPublicKey = createPublicKey({ key: der, format: "der", type: "spki" });
    cachedPublicKeySource = source;
    return cachedPublicKey;
  }
  catch {
    return null;
  }
}

function validateDeviceProof(req, pathname) {
  const headers = req.headers;
  const proof = headers["x-device-proof"];
  const timestamp = headers["x-device-timestamp"];
  const deviceId = headers["x-device-id"];
  const jti = headers["x-device-jti"] || headers["x-request-id"] || "missing-jti";
  if (!proof || !timestamp || !deviceId) {
    return { ok: false, status: 401, type: "DEVICE_PROOF_REQUIRED" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 403, type: "DEVICE_PROOF_INVALID" };
  }
  if (Math.abs(Date.now() - ts) > 60_000) {
    return { ok: false, status: 403, type: "DEVICE_PROOF_INVALID_TIME" };
  }
  const key = loadDevicePublicKey();
  if (!key) {
    return { ok: false, status: 500, type: "DEVICE_PROOF_KEY_MISSING" };
  }
  let signature;
  try {
    signature = Buffer.from(proof, "base64");
  }
  catch {
    return { ok: false, status: 403, type: "DEVICE_PROOF_INVALID" };
  }
  const payload = Buffer.from(`${req.method}|${pathname}|${timestamp}|${jti}`);
  let valid = false;
  try {
    valid = verify(null, payload, key, signature);
  }
  catch {
    return { ok: false, status: 403, type: "DEVICE_PROOF_INVALID" };
  }
  if (!valid) {
    return { ok: false, status: 403, type: "DEVICE_PROOF_INVALID" };
  }
  return { ok: true, deviceId };
}

const server = http.createServer((req, res) => {
  const { pathname, query } = url.parse(req.url, true);
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === "POST" && pathname === "/stamps/claim") {
    const idem = req.headers["idempotency-key"];
    if (!idem) {
      return problem(res, 400, "MISSING_IDEMPOTENCY_KEY");
    }
    if (seen.has(idem)) {
      return problem(res, 409, "TOKEN_REUSE");
    }
    seen.add(idem);
    res.writeHead(201, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === "GET" && pathname === "/secure/ping") {
    return problem(res, 401, "DEVICE_PROOF_REQUIRED");
  }
  if (req.method === "POST" && pathname === "/secure-device") {
    const result = validateDeviceProof(req, pathname);
    if (!result.ok) {
      return problem(res, result.status, result.type);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, deviceId: result.deviceId }));
  }
  if (req.method === "GET" && pathname === "/referrals/link") {
    const tenant = query?.tenant || "starter";
    if (tenant === "starter") {
      return problem(res, 403, "PLAN_NOT_ALLOWED");
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ url: "https://example" }));
  }
  return problem(res, 404, "NOT_FOUND");
});

server.listen(PORT, () => console.log(`Stub API :${PORT}`));
