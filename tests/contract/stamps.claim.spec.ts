import path from "node:path";
import { fileURLToPath } from "node:url";
import chai from "chai";
import chaiResponseValidator from "chai-openapi-response-validator";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const specPath = path.resolve(
  __dirname,
  "../../apps/api/openapi/lokaltreu-openapi-v2.0.yaml"
);
chai.use(chaiResponseValidator(specPath));

const BASE = process.env.API_BASE ?? "http://localhost:3001";

describe.skip("stamps/claim contract", () => {
  it("201 matches schema", async () => {
    const r = await fetch(`${BASE}/stamps/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        /* minimal gültiger Body gemäß OpenAPI */
      }),
    });
    expect([201, 202]).toContain(r.status);
    const json = await r.json();
    chai.expect(json).to.satisfyApiSpec;
  });
});
