import { execSync } from "node:child_process";

try {
  execSync("git diff --exit-code -- packages/types/src/index.d.ts", {
    stdio: "pipe",
  });
  console.log("Schema drift = 0: OpenAPI-Typen unverändert.");
} catch (error) {
  const output = error.stdout?.toString() ?? error.stderr?.toString() ?? "";
  console.error("Schema drift erkannt. Bitte `npm run codegen` lokal ausführen und Änderungen einchecken.");
  if (output) {
    console.error(output);
  }
  process.exit(1);
}
