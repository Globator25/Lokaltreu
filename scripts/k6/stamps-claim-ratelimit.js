import http from "k6/http";
import { check, sleep } from "k6";

// Rate-limit scenario for POST /stamps/claim (separate from idempotency tests).
// Set BASE_URL via env:
// - local: http://127.0.0.1:3000/v2
// - stage: https://api.stage.lokaltreu.example/v2 (or https://<stage-api-domain>/v2)
if (!__ENV.BASE_URL) {
  throw new Error(
    "BASE_URL environment variable is required, e.g. http://127.0.0.1:3000/v2 or https://api.stage.lokaltreu.example/v2"
  );
}

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "10s",
};

const BASE_URL = __ENV.BASE_URL;
const PATH = "/stamps/claim";
const TOKENS_PATH = "/stamps/tokens";
const CARD_ID = __ENV.CARD_ID || "card-rl-1";
const TENANT_ID = __ENV.TENANT_ID || "tenant-rl-1";
const DEVICE_PROOF_HEADERS_JSON = __ENV.DEVICE_PROOF_HEADERS_JSON || "";

function readDeviceProofHeaders() {
  if (!DEVICE_PROOF_HEADERS_JSON) {
    return {};
  }
  const parsed = JSON.parse(DEVICE_PROOF_HEADERS_JSON);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("DEVICE_PROOF_HEADERS_JSON must be a JSON object");
  }
  return parsed;
}

const DEVICE_PROOF_HEADERS = readDeviceProofHeaders();

export default function () {
  // Create a real stamp token before claiming it.
  const tokenRes = http.post(`${BASE_URL}${TOKENS_PATH}`, null, {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `idem-token-${__VU}-${__ITER}-${Date.now()}`,
      "x-tenant-id": TENANT_ID,
      ...DEVICE_PROOF_HEADERS,
    },
  });
  if (tokenRes.status !== 201) {
    throw new Error(`Failed to create stamp token: ${tokenRes.status} ${tokenRes.body}`);
  }
  const tokenBody = tokenRes.json();
  const qrToken = tokenBody.qrToken;
  // Use the issued token for the claim request.
  const payload = JSON.stringify({
    qrToken,
    ref: null,
  });

  const res = http.post(`${BASE_URL}${PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `idem-${__VU}-${__ITER}-${Date.now()}`,
      // Internal test headers for rate-limit scoping (card/tenant).
      "x-card-id": CARD_ID,
      "x-tenant-id": TENANT_ID,
    },
  });

  check(res, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "problem+json on 429": (r) =>
      r.status !== 429 || (r.headers["Content-Type"] || "").includes("application/problem+json"),
    "retry-after on 429": (r) => r.status !== 429 || Number(r.headers["Retry-After"]) > 0,
  });

  sleep(0.2);
}
