import fs from "node:fs";
import path from "node:path";
let ok = true;

// 1) Retention 180 prüfen, wenn config-Dateien existieren
const candidates = [
  "apps/api/src/config.ts",
  "apps/api/config.ts",
  "packages/config/src/index.ts",
];
for (const rel of candidates) {
  const p = path.resolve(rel);
  if (fs.existsSync(p)) {
    const t = fs.readFileSync(p, "utf8");
    if (!/RETENTION_DAYS\s*[:=]\s*180\b/.test(t)) { console.error(`[GDPR] RETENTION_DAYS!=180 in ${rel}`); ok = false; }
  }
}

// 2) Logs grob auf PII prüfen
const logsDir = path.resolve("logs");
if (fs.existsSync(logsDir)) {
  const re = [/email=/i, /password/i, /iban/i];
  for (const f of fs.readdirSync(logsDir)) {
    const t = fs.readFileSync(path.join(logsDir, f), "utf8");
    if (re.some(r => r.test(t))) { console.error(`[GDPR] potential PII in logs/${f}`); ok = false; }
  }
}

if (!ok) process.exit(2);
console.log("GDPR checks passed.");
