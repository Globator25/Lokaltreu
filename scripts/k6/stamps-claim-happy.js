import http from "k6/http";
import { check, sleep } from "k6";

// Happy-path/NFR scenario for POST /stamps/claim.
// Set BASE_URL via env:
// - local: http://127.0.0.1:3001/v2
// - stage: https://api.stage.lokaltreu.example/v2 (or https://<stage-api-domain>/v2)
// Optional env:
// - TOKEN_POOL_SIZE (how many /stamps/tokens to fetch in setup; default 20)
// - QR_TOKENS (comma-separated; if set, setup() skips token creation)
// - DEVICE_PROOF_HEADERS_JSON (JSON object or array for /stamps/tokens; pre-signed headers)
// - CLAIM_PROOF_HEADERS_JSON (JSON array of header objects for /stamps/claim)
// - CARD_ID (optional override, otherwise per VU)
// Note: Device-proof signatures must be precomputed (method|path|ts|jti) and include /v2.
// Example (PowerShell):\n// $env:DEVICE_PROOF_HEADERS_JSON='[{\"x-tenant-id\":\"tenant-1\",\"x-device-id\":\"device-1\",\"x-device-timestamp\":\"1700000000\",\"x-device-nonce\":\"nonce-1\",\"x-device-signature\":\"<sig>\"}]'
export const options = {
  vus: Number(__ENV.VUS || 3),
  duration: __ENV.DURATION || "10s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3001/v2";
const CLAIM_PATH = "/stamps/claim";
const TOKENS_PATH = "/stamps/tokens";
const SIGNATURE_PREFIX = "/v2";
const CLAIM_SIGNATURE_PATH = `${SIGNATURE_PREFIX}${CLAIM_PATH}`;
const TOKENS_SIGNATURE_PATH = `${SIGNATURE_PREFIX}${TOKENS_PATH}`;
const TOKEN_POOL_SIZE = Number(__ENV.TOKEN_POOL_SIZE || 20);

function parseHeadersList(input) {
  if (!input) {
    return [];
  }
  const parsed = JSON.parse(input);
  if (!Array.isArray(parsed)) {
    throw new Error("CLAIM_PROOF_HEADERS_JSON must be a JSON array");
  }
  return parsed;
}

const proofConfig = JSON.parse(__ENV.DEVICE_PROOF_HEADERS_JSON || "{}");

function normalizeProofHeaders(config) {
  if (!config || (typeof config === "object" && Object.keys(config).length === 0)) {
    return [];
  }
  if (Array.isArray(config)) {
    return config;
  }
  if (typeof config === "object") {
    return [config];
  }
  throw new Error("DEVICE_PROOF_HEADERS_JSON must be a JSON object or array");
}

function buildDeviceProofHeaders(method, path, baseHeaders) {
  if (!baseHeaders || typeof baseHeaders !== "object") {
    throw new Error("DEVICE_PROOF_HEADERS_JSON / CLAIM_PROOF_HEADERS_JSON must contain pre-signed device proof headers");
  }
  return { ...baseHeaders };
}

const TOKEN_PROOF_HEADERS = normalizeProofHeaders(proofConfig);
const CLAIM_PROOF_HEADERS =
  parseHeadersList(__ENV.CLAIM_PROOF_HEADERS_JSON).length > 0
    ? parseHeadersList(__ENV.CLAIM_PROOF_HEADERS_JSON)
    : TOKEN_PROOF_HEADERS;

function buildHeaders() {
  const cardId = __ENV.CARD_ID || `card-${__VU}`;
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2);

  return {
    "Content-Type": "application/json",
    "Idempotency-Key": `idem-${__VU}-${now}-${rand}`,
    // Internal test headers for rate-limit scoping (card/tenant).
    "x-card-id": cardId,
  };
}

export function setup() {
  if (__ENV.QR_TOKENS) {
    return {
      tokens: __ENV.QR_TOKENS.split(",").map((token) => token.trim()).filter(Boolean),
      claimHeaders: CLAIM_PROOF_HEADERS,
    };
  }
  if (TOKEN_PROOF_HEADERS.length === 0) {
    throw new Error(
      "DEVICE_PROOF_HEADERS_JSON is required to create tokens via /stamps/tokens (or set QR_TOKENS)"
    );
  }
  const tokens = [];
  for (let i = 0; i < TOKEN_POOL_SIZE; i += 1) {
    const proofHeaders = TOKEN_PROOF_HEADERS[i % TOKEN_PROOF_HEADERS.length];
    const deviceProofHeaders = buildDeviceProofHeaders("POST", TOKENS_SIGNATURE_PATH, proofHeaders);
    const res = http.post(`${BASE_URL}${TOKENS_PATH}`, null, {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `idem-token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...deviceProofHeaders,
      },
    });
    if (res.status !== 201) {
      throw new Error(`Failed to create token: ${res.status} ${res.body}`);
    }
    const body = res.json();
    tokens.push(body.qrToken);
  }
  return { tokens, claimHeaders: CLAIM_PROOF_HEADERS };
}

let claimIndex = 0;

export default function (data) {
  const tokens = data && data.tokens ? data.tokens : [];
  const token = tokens.length > 0 ? tokens[claimIndex % tokens.length] : null;
  if (!token) {
    throw new Error("No qrToken available; set QR_TOKENS or DEVICE_PROOF_HEADERS_JSON");
  }
  const claimHeaders = data && data.claimHeaders ? data.claimHeaders : [];
  const proofHeaders = claimHeaders.length > 0 ? claimHeaders[claimIndex % claimHeaders.length] : {};
  const deviceProofHeaders =
    claimHeaders.length > 0 ? buildDeviceProofHeaders("POST", CLAIM_SIGNATURE_PATH, proofHeaders) : {};
  claimIndex += 1;

  const payload = JSON.stringify({
    qrToken: token,
    ref: null,
  });

  const res = http.post(`${BASE_URL}${CLAIM_PATH}`, payload, {
    headers: {
      ...buildHeaders(),
      ...deviceProofHeaders,
    },
  });

  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.2);
}
