import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  iterations: 10,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function deviceOnboardingHappy() {
  const baseUrl = __ENV.BASE_URL ?? "http://localhost:3000";
  const adminAccessToken = __ENV.ADMIN_ACCESS_TOKEN;

  check(adminAccessToken, {
    "ADMIN_ACCESS_TOKEN is set": (value) => typeof value === "string" && value.length > 0,
  });
  if (!adminAccessToken) {
    return;
  }

  const createRes = http.post(
    `${baseUrl}/devices/registration-links`,
    JSON.stringify({}),
    {
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminAccessToken}`,
        "idempotency-key": `device-onboarding-create-${__VU}-${__ITER}-${Date.now()}`,
      },
    },
  );

  check(createRes, {
    "create returns 201": (r) => r.status === 201,
  });
  if (createRes.status !== 201) {
    return;
  }

  const createBody = createRes.json();
  const token = createBody?.token;
  check(token, {
    "create returns token": (value) => typeof value === "string" && value.length > 0,
  });
  if (typeof token !== "string") {
    return;
  }

  const confirmRes = http.post(
    `${baseUrl}/devices/register/confirm`,
    JSON.stringify({ token }),
    {
      headers: {
        "content-type": "application/json",
        "idempotency-key": `device-onboarding-confirm-${__VU}-${__ITER}-${Date.now()}`,
      },
    },
  );

  check(confirmRes, {
    "confirm returns 204": (r) => r.status === 204,
  });

  sleep(0.1);
}

