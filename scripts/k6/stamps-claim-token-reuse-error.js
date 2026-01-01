import http from "k6/http";
import { check, sleep } from "k6";

// Error-path load test for TOKEN_REUSE (404) responses.
// This scenario intentionally exercises an invalid/reused token path and is not the happy path.
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
const PATH = "/stamps/claim/invalid";

export default function () {
  const payload = JSON.stringify({
    qrToken: `token-${__VU}-${__ITER}`,
    ref: null,
  });

  const res = http.post(`${BASE_URL}${PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `idem-${__VU}-${__ITER}-${Date.now()}`,
    },
  });

  check(res, {
    "status is 404": (r) => r.status === 404,
    "problem+json": (r) => (r.headers["Content-Type"] || "").includes("application/problem+json"),
    "error_code TOKEN_REUSE": (r) => r.json("error_code") === "TOKEN_REUSE",
  });

  sleep(0.2);
}
