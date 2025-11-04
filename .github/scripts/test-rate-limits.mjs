import { execSync } from "node:child_process";

try {
  execSync("npm run test:ratelimits", { stdio: "inherit" });
  console.log("Rate-Limit Tests erfolgreich für /stamps/claim und /rewards/redeem.");
} catch (error) {
  console.error("Rate-Limit Tests fehlgeschlagen.");
  process.exit(error.status ?? 1);
}
