import { execSync } from "node:child_process";

try {
  execSync("npm run test:device", { stdio: "inherit" });
  console.log("Device-Proof Tests erfolgreich (Ed25519 Proof Cases).");
} catch (error) {
  console.error("Device-Proof Tests fehlgeschlagen.");
  process.exit(error.status ?? 1);
}
