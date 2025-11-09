/**
 * Coverage-Enforcer (CommonJS)
 * Usage: node scripts/enforce-coverage.js --min=80
 */
const { readFileSync, existsSync } = require("fs");
const path = require("path");

function getArg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const min = Number(getArg("--min", process.env.MIN_COVERAGE || "80"));
const root = process.cwd();

const candidates = [
  path.join(root, "coverage", "coverage-summary.json"),
  path.join(root, "apps", "api", "coverage", "coverage-summary.json"),
];

const file = candidates.find(existsSync);
if (!file) {
  console.error("coverage-summary.json nicht gefunden. Kandidaten:\n" + candidates.join("\n"));
  process.exit(2);
}

let json;
try {
  json = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error("Konnte Coverage-JSON nicht parsen:", e?.message || e);
  process.exit(3);
}

const required = ["lines", "functions", "branches", "statements"];
const total = json.total || {};
let ok = true;

const lines = required
  .map((k) => {
    const pct = Number(total[k]?.pct ?? NaN);
    const pass = !Number.isNaN(pct) && pct >= min;
    ok &&= pass;
    return `${k.padEnd(10)}: ${String(Number.isNaN(pct) ? "NaN" : pct).padStart(6)}%  (${
      pass ? "OK" : "FAIL"
    })`;
  })
  .join("\n");

console.log(`Coverage-Gate: Mindestabdeckung >= ${min}%\n${lines}`);
if (!ok) {
  console.error("Coverage-Gate nicht erfüllt.");
  process.exit(1);
}
console.log("Coverage-Gate erfüllt.");
