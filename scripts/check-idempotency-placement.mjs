import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  const entries = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      entries.push(...walk(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

const disallowedRoots = [
  "apps/api/src/handlers",
  "apps/api/src/services",
  "apps/api/src/routes",
];

const violations = [];

for (const root of disallowedRoots) {
  let files = [];
  try {
    files = walk(root);
  } catch {
    continue;
  }

  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const content = readFileSync(file, "utf8");
    if (content.includes("requireIdempotency")) {
      violations.push(`Idempotency-Logik darf nicht in Business-Dateien liegen: ${file}`);
    }
    if (/\bIdempotency-Key\b/.test(content)) {
      violations.push(`Idempotency-Header gehört in Middleware, nicht in ${file}`);
    }
  }
}

if (violations.length > 0) {
  for (const msg of violations) {
    console.error(msg);
  }
  process.exit(1);
}

console.log("Idempotency-Placement Check erfolgreich.");
