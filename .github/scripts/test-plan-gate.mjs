import { execSync } from "node:child_process";

try {
  execSync("npm run test:plan", { stdio: "inherit" });
  console.log("Plan-Gate Tests erfolgreich (403 PLAN_NOT_ALLOWED).");
} catch (error) {
  console.error("Plan-Gate Tests fehlgeschlagen.");
  process.exit(error.status ?? 1);
}
