#!/usr/bin/env node
// scripts/gdpr/scan-logs-no-pii.mjs
// Scannt "logs/" und "apps/**/logs/**" (falls vorhanden) auf einfache PII-Pattern.
import { readFileSync, existsSync } from "node:fs";
import { globSync } from "glob";

const globs = ["logs/**/*.log", "apps/**/logs/**/*.log"];
const files = globs.flatMap(g => globSync(g, { nodir: true }));
if (!files.length) { console.log("No logs found, skipping."); process.exit(0); }

const patterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // email
  /\b\d{1,3}(\.\d{1,3}){3}\b/,              // IPv4
  /\b(?:\+|00)\d{7,15}\b/,                   // phone rough
];
let hits = [];
for (const f of files) {
  const txt = readFileSync(f, "utf8");
  if (patterns.some(rx => rx.test(txt))) hits.push(f);
}
if (hits.length) {
  console.error("PII found in logs:", hits);
  process.exit(1);
}
console.log("Logs clean. No PII patterns matched.");
