import http from "k6/http";
import { check, sleep } from "k6";

// Error-path load test for TOKEN_REUSE (409) responses.
// This scenario intentionally reuses a known QR token.
// Set BASE_URL via env:
// - local: http://127.0.0.1:3000/v2
// - stage: https://api.stage.lokaltreu.example/v2 (or https://<stage-api-domain>/v2)
if (!__ENV.BASE_URL || !__ENV.QR_TOKEN) {
  throw new Error(
    "BASE_URL and QR_TOKEN are required, e.g. BASE_URL=http://127.0.0.1:3000/v2 QR_TOKEN=token-abc"
  );
}

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "10s",
};

const BASE_URL = __ENV.BASE_URL;
const PATH = "/stamps/claim";
const QR_TOKEN = __ENV.QR_TOKEN;
const PRE_CLAIM = __ENV.PRE_CLAIM !== "false";

export function setup() {
  if (!PRE_CLAIM) {
    return;
  }
  const payload = JSON.stringify({
    qrToken: QR_TOKEN,
    ref: null,
  });
  http.post(`${BASE_URL}${PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `idem-preclaim-${Date.now()}`,
    },
  });
}

export default function () {
  const payload = JSON.stringify({
    qrToken: QR_TOKEN,
    ref: null,
  });

  const res = http.post(`${BASE_URL}${PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `idem-${__VU}-${__ITER}-${Date.now()}`,
    },
  });

  check(res, {
    "status is 409": (r) => r.status === 409,
    "problem+json": (r) => (r.headers["Content-Type"] || "").includes("application/problem+json"),
    "error_code TOKEN_REUSE": (r) => r.json("error_code") === "TOKEN_REUSE",
  });

  sleep(0.2);
}
