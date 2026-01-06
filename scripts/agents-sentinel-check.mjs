#!/usr/bin/env node
// scripts/agents-sentinel-check.mjs
import { readFileSync, existsSync } from "node:fs";
const path = "AGENTS.md";
if (!existsSync(path)) { console.error("AGENTS.md missing"); process.exit(1); }
const txt = readFileSync(path, "utf8").trim();
if (!txt.length) { console.error("AGENTS.md empty"); process.exit(1); }
if (!/^#\s*AGENTS\b/i.test(txt)) { console.warn("AGENTS.md heading not found, continuing"); }
console.log("AGENTS.md Sentinel-Check OK.");
