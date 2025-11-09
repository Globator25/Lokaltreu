#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SPEC = process.env.OPENAPI_SPEC || "apps/api/openapi/lokaltreu-openapi-v2.0.yaml";
const OUT  = "apps/api/.openapi.hash";

function sha(p){ return createHash("sha256").update(readFileSync(p)).digest("hex"); }

try {
  const hash = sha(SPEC);
  let old = ""; try { old = readFileSync(OUT,"utf8").trim(); } catch {}
  if (old && old !== hash) {
    console.error("schema_drift≠0 → OpenAPI-Spec hat sich geändert.");
    console.error("alt=" + old + "\nneu=" + hash);
    process.exit(1);
  }
  writeFileSync(OUT, hash);
  console.log("schema_drift=0");
} catch (e) {
  console.error("Contract-Check Fehler: " + e.message);
  process.exit(1);
}
