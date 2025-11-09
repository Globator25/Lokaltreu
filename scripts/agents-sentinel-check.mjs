#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { exit } from "node:process";

const text = (() => {
  try { return readFileSync("AGENTS.md","utf8"); } catch { console.error("AGENTS.md nicht gefunden"); exit(1); }
})();

const sentinels = [
  "[SENTINEL] SECTION: Projektfakten",
  "[SENTINEL] SECTION: CI-Gates (MUSS)",
  "[SENTINEL] SECTION: Aufgabenrezepte",
  "[SENTINEL] SECTION: Audit-Trail",
  "[SENTINEL] SECTION: ZENTRALE PR-CHECKLISTE",
];
const roles = ["ProblemJSON-Arbiter","Idempotency-Guardian","Device-Proof-Engineer","Audit-Officer","Test-Pilot","Docs-Keeper"];
const kpis  = ["error_conformity","replay_blocks","coverage","proof_failures_caught","audit_gaps"];
const gates = ["schema_drift = 0","RFC 7807","Anti-Replay","Device-Proof","PLAN_NOT_ALLOWED","OpenAPI-Lint","Terraform","GDPR","required checks"];

let ok = true; const assert=(c,m)=>{ if(!c){console.error(`✗ ${m}`); ok=false;} };

assert(/^#\s+Lokaltreu AGENTS\.md/i.test(text),"Header/Version fehlt");
assert(/Owner:\s*\S+/.test(text),"Owner fehlt");
assert(/Letzte Prüfung:\s*\d{4}-\d{2}-\d{2}/.test(text),"Letzte Prüfung fehlt");
sentinels.forEach(s=>assert(text.includes(s),`Sentinel fehlt: ${s}`));
roles.forEach(r=>assert(text.includes(r),`Rolle fehlt: ${r}`));
kpis.forEach(k=>assert(text.includes(k),`KPI fehlt: ${k}`));
gates.forEach(g=>assert(text.includes(g),`Gate fehlt: ${g}`));

if(!ok){ console.error("AGENTS.md Sentinel-Check FAIL"); exit(1); }
console.log("AGENTS.md Sentinel-Check OK.");
