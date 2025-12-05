// scripts/gdpr/docs-present.mjs
import fs from "node:fs";
import path from "node:path";

const requiredDocs = [
  "compliance/AVV.md",
  "compliance/TOMs.md",
  "compliance/RoPA.md",
  "compliance/DPIA.md",
  "compliance/Infos-DE.md",
  "compliance/Retention-Policy.md",
  "docs/runbooks/Incident-Breach.md",
];

function checkDocsPresent() {
  const missing = [];

  for (const relPath of requiredDocs) {
    const fullPath = path.resolve(process.cwd(), relPath);
    try {
      fs.accessSync(fullPath, fs.constants.R_OK);
    } catch {
      missing.push(relPath);
    }
  }

  if (missing.length > 0) {
    console.error("❌ GDPR compliance docs missing:");
    for (const doc of missing) {
      console.error(`  - ${doc}`);
    }
    process.exitCode = 1;
  } else {
    console.log("✅ All required GDPR docs present.");
  }
}

checkDocsPresent();
