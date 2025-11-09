const fs = require("fs"), p = require("path");
const min = { lines:80, functions:80, branches:80, statements:80 };
const file = p.resolve("coverage/coverage-summary.json");
if (!fs.existsSync(file)) { console.error("coverage-summary.json fehlt"); process.exit(1); }
const sum = JSON.parse(fs.readFileSync(file, "utf8")).total;
const fields = ["lines","functions","branches","statements"];
let ok = true;
for (const f of fields) {
  const pct = sum[f]?.pct ?? 0;
  const pass = pct >= min[f];
  console.log(`${f.padEnd(10)}: ${pct.toFixed(2).padStart(6)}%  ${pass ? "(OK)":"(FAIL)"}`);
  ok &&= pass;
}
if (!ok) process.exit(1);
