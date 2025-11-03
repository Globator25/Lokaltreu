import { execSync } from "node:child_process";

try {
  execSync("npm run test:replay", { stdio: "inherit" });
  console.log("Anti-Replay Tests erfolgreich (Erwartung: 1x201, 9x409).");
} catch (error) {
  console.error("Anti-Replay Tests fehlgeschlagen.");
  process.exit(error.status ?? 1);
}
