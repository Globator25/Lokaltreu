import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Repo-Root = Parent von "scripts/"
const repoRoot = path.resolve(__dirname, "..");

const src = path.join(repoRoot, "apps", "api", "openapi", "lokaltreu-openapi-v2.0.yaml");
const dst = path.join(repoRoot, "apps", "api", "openapi", "lokaltreu-openapi-v2.0.mock.yaml");

function resolvePort() {
  const arg0 = process.argv[2];
  if (arg0 && /^[0-9]+$/.test(arg0)) return Number(arg0);

  const env = process.env.PRISM_PORT;
  if (env && /^[0-9]+$/.test(env)) return Number(env);

  return 4013;
}

const port = resolvePort();
console.log(`Starting Prism mock on http://127.0.0.1:${port}`);

// Read + patch spec
let text = fs.readFileSync(src, "utf8");

// Patch: /admins/reporting/summary GET => security: []
text = text.replace(
  /(^\s{2}\/admins\/reporting\/summary:\s*\r?\n\s{4}get:\s*\r?\n(?:\s{6}.*\r?\n)*?)\s{6}security:\s*\r?\n(?:\s{8}-\s*AdminAuth:\s*\[\]\s*\r?\n)+/m,
  `$1      security: []\n`
);

// Patch: /admins/reporting/timeseries GET => security: []
text = text.replace(
  /(^\s{2}\/admins\/reporting\/timeseries:\s*\r?\n\s{4}get:\s*\r?\n(?:\s{6}.*\r?\n)*?)\s{6}security:\s*\r?\n(?:\s{8}-\s*AdminAuth:\s*\[\]\s*\r?\n)+/m,
  `$1      security: []\n`
);

fs.writeFileSync(dst, text, "utf8");

// Prism executable
const prismCmd = process.platform === "win32"
  ? path.join(repoRoot, "node_modules", ".bin", "prism.cmd")
  : path.join(repoRoot, "node_modules", ".bin", "prism");

const child = spawn(
  prismCmd,
  ["mock", dst, "-p", String(port)],
  { stdio: "inherit", cwd: repoRoot, shell: process.platform === "win32" }
);

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to start Prism:", err);
  process.exit(1);
});
