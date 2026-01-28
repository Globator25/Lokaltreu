import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const libsodiumCjs = pathResolve(
  __dirname,
  "../../node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js"
);

export default defineConfig({
  resolve: {
    conditions: ["node", "require", "default"],
    mainFields: ["module", "main"],
    alias: [
      {
        find: /^libsodium-wrappers$/,
        replacement: libsodiumCjs,
      },
    ],
  },
  optimizeDeps: {
    exclude: ["libsodium-wrappers", "libsodium"],
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    deps: {
      optimizer: {
        ssr: {
          exclude: ["libsodium-wrappers", "libsodium"],
        },
      },
    },
    alias: {
      "^libsodium-wrappers$": libsodiumCjs,
    },

    include: [
      "src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "tests/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    exclude: ["node_modules/**", "dist/**"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts", "tests/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.{test,spec}.?(c|m)[jt]s?(x)",
        "**/*.http.spec.*",
        "dist/**",
        "node_modules/**",
        "scripts/**",
        "tools/**",
        "artifacts/**",
        "src/dev/**",
        "src/dev-*.ts",
        "src/server-main.ts",

        // Bootstrap/Entry (tendenziell schwer/unnötig zu covern)
        "src/index.ts",

        // ✅ types-only Datei: sonst 0% Noise im Report
        "src/handlers/admins/types.ts",
      ],
    },
  },
});
