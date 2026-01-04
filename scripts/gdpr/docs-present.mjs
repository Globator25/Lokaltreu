// scripts/gdpr/docs-present.mjs
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const docs = [
  "docs/compliance/step-17-idempotency-rate-limits.md",
  "docs/compliance/step-18-device-onboarding.md",
];

async function main() {
  try {
    for (const relPath of docs) {
      const absPath = resolve(process.cwd(), relPath);
      await access(absPath, constants.R_OK);
      console.log(`[gdpr:docs:present] OK: ${relPath}`);
    }
    process.exit(0);
  } catch (err) {
    console.error("[gdpr:docs:present] missing required GDPR doc:", err?.message ?? err);
    process.exit(1);
  }
}

main();

