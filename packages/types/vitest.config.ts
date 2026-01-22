import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    // Keine Tests in diesem Package ausführen (Types-only)
    include: [],
    exclude: ["**/*"],

    // Falls Vitest doch "0 tests" sieht, soll das kein Fehler sein
    passWithNoTests: true,
  },
});
