import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { startServer } from "./index.js";

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");

if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  startServer(port)
    .then(() => {
      console.warn("Lokaltreu API startet...");
    })
    .catch((err) => {
      console.error("Failed to start Lokaltreu API", err);
      process.exit(1);
    });
}
