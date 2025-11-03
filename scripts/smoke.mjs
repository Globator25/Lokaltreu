import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const logdir = "artifacts/smoke";
mkdirSync(logdir, { recursive: true });

async function capture(name, url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }

  const artifact = {
    name,
    url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };

  writeFileSync(join(logdir, `${name}.json`), JSON.stringify(artifact, null, 2));
  return response.status;
}

const base = "http://localhost:4010";

const statusIssueToken = await capture("stamps-tokens", `${base}/stamps/tokens`, {
  method: "POST",
  headers: {
    "Idempotency-Key": "smoke-token-issue",
    "Content-Type": "application/json",
  },
});

const statusClaimStamp = await capture("stamps-claim", `${base}/stamps/claim`, {
  method: "POST",
  headers: {
    "Idempotency-Key": "smoke-claim",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ qrToken: "qr-smoke-token" }),
});

const statusReferral = await capture("referrals-link", `${base}/referrals/link`, {
  method: "GET",
});

const summary = {
  "stamps/tokens": statusIssueToken,
  "stamps/claim": statusClaimStamp,
  "referrals/link": statusReferral,
};

writeFileSync(join(logdir, "summary.json"), JSON.stringify(summary, null, 2));

const allExpected =
  statusIssueToken === 201 &&
  statusClaimStamp === 201 &&
  statusReferral === 403;

if (!allExpected) {
  console.error("Smoke expectations failed", summary);
  process.exit(1);
}
