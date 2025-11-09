const { existsSync, mkdirSync, copyFileSync } = require("fs");
const { join } = require("path");

const candidates = [
  join(process.cwd(), "coverage", "coverage-summary.json"),
  join(process.cwd(), "apps", "api", "coverage", "coverage-summary.json"),
];

const src = candidates.find(existsSync);
if (!src) {
  console.error("coverage-summary.json nicht gefunden. Kandidaten:\n" + candidates.join("\n"));
  process.exit(1);
}

const dstDir = join(process.cwd(), "coverage");
mkdirSync(dstDir, { recursive: true });
const dst = join(dstDir, "coverage-summary.json");
copyFileSync(src, dst);
console.log("Coverage-Summary kopiert:", src, "→", dst);
