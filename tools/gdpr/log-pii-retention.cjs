#!/usr/bin/env node

/**
 * GDPR "Log PII + retention" gate for step 18.
 *
 * Zweck:
 * - Sicherstellen, dass es für Step 18 eine Compliance-Doku gibt
 *   (docs/compliance/step-18-device-onboarding.md)
 * - Prüfen, dass dort grundlegende Aussagen zu Logging und Retention stehen.
 *
 * Wenn etwas fehlt, wird mit Exit-Code 1 abgebrochen (GitHub Actions schlägt dann fehl).
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const docPath = path.join(
  rootDir,
  "docs",
  "compliance",
  "step-18-device-onboarding.md",
);

function fail(message) {
  console.error("GDPR logs gate FAILED:");
  console.error("  " + message);
  process.exit(1);
}

function ok(message) {
  console.log("GDPR logs gate OK:");
  console.log("  " + message);
  process.exit(0);
}

// 1) Dokument muss existieren
if (!fs.existsSync(docPath)) {
  fail(
    `Compliance-Dokument nicht gefunden: ${docPath}. ` +
      "Erwartet wird docs/compliance/step-18-device-onboarding.md.",
  );
}

const content = fs.readFileSync(docPath, "utf8");

// 2) Ein paar einfache Plausibilitätschecks:
const requiredSnippets = [
  "# Step 18",
  "## Sicherheit & Compliance",
  "DSR- und Tombstone-Integration",
  "Retention",
  "expires_at",
];

const missing = requiredSnippets.filter(
  (snippet) => !content.includes(snippet),
);

if (missing.length > 0) {
  fail(
    "Im Step-18-Compliance-Dokument fehlen erwartete Textbausteine:\n" +
      "  " +
      missing.join("\n  "),
  );
}

ok(
  "Step-18-Compliance-Dokument vorhanden und enthält Logging-/Retention-Bezug.",
);
