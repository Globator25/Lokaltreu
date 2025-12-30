import http from "k6/http";
import { check, sleep } from "k6";

// Rate-limit/idempotency scenario for POST /stamps/claim.
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
const CARD_ID = __ENV.CARD_ID || "card-load-1";
const TENANT_ID = __ENV.TENANT_ID || "tenant-load-1";
const SHARED_KEY = __ENV.SHARED_IDEMPOTENCY_KEY || "idem-shared-claim";
const REUSE_EVERY = Number(__ENV.REUSE_EVERY || 3);

function buildHeaders(useSharedKey) {
  const idempotencyKey = useSharedKey ? SHARED_KEY : `idem-${__VU}-${__ITER}-${Date.now()}`;
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
    // Internal test headers for rate-limit scoping (card/tenant).
    "x-card-id": CARD_ID,
    "x-tenant-id": TENANT_ID,
  };
}

export default function () {
  const useSharedKey = __ITER % REUSE_EVERY === 0;
  const payload = JSON.stringify({
    qrToken: `token-${__VU}-${__ITER}`,
    ref: null,
  });

  const res = http.post(`${BASE_URL}${PATH}`, payload, {
    headers: buildHeaders(useSharedKey),
  });

  check(res, {
    "status is 2xx or 429": (r) => (r.status >= 200 && r.status < 300) || r.status === 429,
    "problem+json on 429": (r) =>
      r.status !== 429 || (r.headers["Content-Type"] || "").includes("application/problem+json"),
    "retry-after on 429": (r) => r.status !== 429 || Number(r.headers["Retry-After"]) > 0,
  });

  sleep(0.2);
}
