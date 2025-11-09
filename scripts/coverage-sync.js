const fs = require("fs"), p = require("path");
const src = p.resolve("apps/api/coverage/coverage-summary.json");
const dstDir = p.resolve("coverage"); const dst = p.join(dstDir, "coverage-summary.json");
if (!fs.existsSync(src)) { process.exit(0); }
fs.mkdirSync(dstDir, { recursive: true }); fs.copyFileSync(src, dst);
console.log(`Coverage-Summary kopiert: ${src} → ${dst}`);
