#!/usr/bin/env node
// scripts/check-docs-present.mjs
// Erwartet Ordner "compliance" mit Kern-Dokumenten. Fehlende -> exit 1.
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dir = process.argv[2] || "compliance";
const base = join(root, "docs", dir);
const required = ["AVV", "TOMs", "RoPA", "DPIA", "Infos-DE"];

const missing = required.filter(n => !existsSync(join(base, n)));
if (missing.length) {
  console.error("Missing compliance docs:", missing.join(", "));
  process.exit(1);
}
console.log("Compliance docs present:", required.join(", "));
