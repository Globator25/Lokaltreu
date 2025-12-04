#!/usr/bin/env node
// scripts/check-retention.mjs
// Erwartet Datei docs/compliance/retention.json mit {"days": <number>}
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const min = Number(process.argv[2] || 180);
const file = join(process.cwd(), "docs", "compliance", "retention.json");

if (!existsSync(file)) {
  console.error("Retention file missing:", file);
  process.exit(1);
}
const days = JSON.parse(readFileSync(file, "utf8")).days;
if (!Number.isFinite(days) || days < min) {
  console.error(`Retention ${days}d < required ${min}d`);
  process.exit(1);
}
console.log(`Retention OK: ${days}d ≥ ${min}d`);
