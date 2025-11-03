import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const disallowedTokens = [/email/i, /phone/i, /adresse/i, /address/i, /ssn/i, /passport/i];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const consoleViolations = [];
for (const file of walk("apps/api/src")) {
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes("console.")) return;
    for (const token of disallowedTokens) {
      if (token.test(line)) {
        consoleViolations.push(`${file}:${index + 1} enthält potentiell PII (${token}).`);
      }
    }
  });
}

const complianceDoc = "docs/05-Compliance.md";
const complianceText = readFileSync(complianceDoc, "utf8");
const hasRetention = complianceText.includes("180 Tage");

if (consoleViolations.length > 0 || !hasRetention) {
  for (const violation of consoleViolations) {
    console.error(violation);
  }
  if (!hasRetention) {
    console.error(`${complianceDoc} muss den Retention-Hinweis "180 Tage" enthalten.`);
  }
  process.exit(1);
}

console.log("Log-Scan erfolgreich: keine PII-Logs entdeckt, Retention-Hinweis vorhanden.");
