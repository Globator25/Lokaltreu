// scripts/schema-drift.mjs
import { readFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Repository-Root (eine Ebene über /scripts)
const repoRoot = path.resolve(__dirname, "..");

const OPENAPI_FILE = path.join(
  repoRoot,
  "apps",
  "api",
  "openapi",
  "lokaltreu-openapi-v2.0.yaml",
);

const TYPES_FILE = path.join(
  repoRoot,
  "packages",
  "types",
  "src",
  "index.d.ts",
);

// temporäre Datei, in die wir für den Vergleich generieren
const TMP_FILE = path.join(
  repoRoot,
  "packages",
  "types",
  "src",
  "index.d.ts.tmp",
);

/**
 * Hilfsfunktion, um ein Kommando auszuführen und stdout/stderr durchzureichen.
 */
function run(cmd) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { cwd: repoRoot }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    // falls wir später noch Streams brauchen, könnten wir hier anhängen
    child.on("error", reject);
  });
}

/**
 * Normalisiere Zeilenenden und berechne einen Hash für stabilen Vergleich.
 */
function hashContent(content) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

async function main() {
  console.log("[schema_drift] Generiere temporäre Types aus OpenAPI …");
  await run(
    `npx openapi-typescript "${OPENAPI_FILE}" -o "${TMP_FILE}"`,
  );

  console.log("[schema_drift] Vergleiche generierte Types mit eingecheckter Datei …");
  const [committed, regenerated] = await Promise.all([
    readFile(TYPES_FILE, "utf8"),
    readFile(TMP_FILE, "utf8"),
  ]);

  // tmp-Datei wieder entfernen, damit das Repo sauber bleibt
  await unlink(TMP_FILE).catch(() => {});

  const committedHash = hashContent(committed);
  const regeneratedHash = hashContent(regenerated);

  if (committedHash !== regeneratedHash) {
    console.error("");
    console.error("❌ schema_drift erkannt:");
    console.error(
      "OpenAPI und packages/types/src/index.d.ts sind nicht synchron.",
    );
    console.error("");
    console.error("Bitte ausführen:");
    console.error("  npm run contract:types:generate");
    console.error("und die geänderte Datei committen.");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("✅ schema_drift = 0 (OpenAPI und @lokaltreu/types sind im Sync).");
}

main().catch((error) => {
  console.error("❌ schema_drift-Check ist technisch fehlgeschlagen:", error);
  process.exitCode = 1;
});
