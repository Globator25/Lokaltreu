import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

const requiredDocs = [
  "compliance/AVV.md",
  "compliance/TOMs.md",
  "compliance/RoPA.md",
  "compliance/DPIA.md",
  "compliance/Infos-DE.md",
  "compliance/Retention-Policy.md",
];

const missing = [];
for (const rel of requiredDocs) {
  const docPath = path.resolve(rel);
  try {
    accessSync(docPath, constants.R_OK);
    const stats = statSync(docPath);
    if (!stats.isFile() || stats.size === 0) {
      missing.push(`${rel} ist leer oder kein File.`);
    }
  } catch {
    missing.push(`${rel} nicht gefunden.`);
  }
}

if (missing.length > 0) {
  missing.forEach((msg) => console.error(`[GDPR] ${msg}`));
  process.exit(1);
}

console.log("GDPR-Dokumente vollständig vorhanden.");
