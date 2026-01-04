import http from "k6/http";
import { check } from "k6";

// Mini-load/parallel scenario for POST /rewards/redeem (Step 20 DoD).
//
// Required env:
// - BASE_URL: e.g. http://127.0.0.1:3000 or https://api.stage.lokaltreu.example
// - REDEEM_TOKEN: a fresh token (not yet redeemed)
//
// Optional env:
// - DEVICE_PROOF_HEADERS_JSON: JSON object with headers for device auth, e.g.
//   {"x-device-key":"device-1","x-device-proof":"<base64sig>","x-device-timestamp":"<unix-seconds>"}
//
// Note: X-Device-Timestamp must be within ±30s of server time; keep the test duration short
// or generate headers just before running k6.

if (!__ENV.BASE_URL) {
  throw new Error("BASE_URL environment variable is required");
}
if (!__ENV.REDEEM_TOKEN) {
  throw new Error("REDEEM_TOKEN environment variable is required");
}

export const options = {
  scenarios: {
    parallel_redeem: {
      executor: "per-vu-iterations",
      vus: Number(__ENV.VUS || 10),
      iterations: Number(__ENV.ITERATIONS || 1),
      maxDuration: __ENV.MAX_DURATION || "10s",
    },
  },
};

const BASE_URL = __ENV.BASE_URL.replace(/\/+$/u, "");
const PATH = "/rewards/redeem";
const REDEEM_TOKEN = __ENV.REDEEM_TOKEN;
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
  const payload = JSON.stringify({ redeemToken: REDEEM_TOKEN });
  const res = http.post(`${BASE_URL}${PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `idem-redeem-${__VU}-${__ITER}-${Date.now()}`,
      ...DEVICE_PROOF_HEADERS,
    },
  });

  check(res, {
    "status is 200 or 409": (r) => r.status === 200 || r.status === 409,
    "problem+json on 409": (r) =>
      r.status !== 409 || (r.headers["Content-Type"] || "").includes("application/problem+json"),
  });
}

