import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const MIN_COVERAGE = 80;

const ensureSummary = () => {
  const defaultPath = resolve("coverage/coverage-summary.json");
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  const candidates = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        visit(full);
        continue;
      }
      if (entry === "coverage-summary.json") {
        candidates.push(full);
      }
    }
  };

  visit(resolve("."));

  if (candidates.length === 0) {
    throw new Error("Keine coverage-summary.json gefunden. Wurde Vitest mit --coverage ausgeführt?");
  }

  // Bevorzuge Root-Datei, andernfalls erste gefundene.
  candidates.sort();
  return candidates[0];
};

const summaryPath = ensureSummary();
const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
const totals = summary.total ?? summary;

const metrics = [
  ["statements", totals.statements?.pct],
  ["branches", totals.branches?.pct],
  ["functions", totals.functions?.pct],
  ["lines", totals.lines?.pct],
];

const failures = metrics
  .filter(([, value]) => typeof value === "number" && value < MIN_COVERAGE)
  .map(([metric, value]) => `${metric}: ${value}% < ${MIN_COVERAGE}%`);

if (failures.length > 0) {
  console.error("Coverage-Anforderung (>= 80%) verfehlt:", failures.join("; "));
  process.exit(1);
}

const missing = metrics
  .filter(([, value]) => typeof value !== "number")
  .map(([metric]) => metric);

if (missing.length > 0) {
  console.error("Coverage-Daten fehlen für:", missing.join(", "));
  process.exit(1);
}

console.log(`Coverage-Check bestanden (${summaryPath}) ≥ ${MIN_COVERAGE}% für Statements, Branches, Functions, Lines.`);
