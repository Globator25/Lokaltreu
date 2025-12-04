#!/usr/bin/env node
// scripts/terraform-enforce-eu.mjs
// Prüft HCL/Textdateien in infra/terraform/** auf regions außerhalb EU.
// Erlaubt: eu-*, europe-*, westeurope, northeurope, europe-west*, europe-central*.
import { readFileSync } from "node:fs";
import { globSync } from "glob";

const root = process.argv[2] || "infra/terraform";
const files = globSync(`${root}/**/*.{tf,tfvars}`, { nodir: true });
if (!files.length) { console.log("No terraform files, skipping."); process.exit(0); }

const euOk = /(eu-|europe-|westeurope|northeurope|europe-west\d+|europe-central\d+)/i;
const bad = [];
for (const f of files) {
  const txt = readFileSync(f, "utf8");
  const lines = txt.split(/\r?\n/);
  for (let i=0;i<lines.length;i++) {
    const L = lines[i];
    if (/region\s*=/.test(L) && !euOk.test(L)) bad.push(`${f}:${i+1}:${L.trim()}`);
  }
}
if (bad.length) {
  console.error("Non-EU regions detected:\n" + bad.join("\n"));
  process.exit(1);
}
console.log("Terraform regions restricted to EU.");
