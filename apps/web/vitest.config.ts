import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const plugins: unknown[] = [];

  try {
    const { default: react } = await import("@vitejs/plugin-react");
    plugins.push(react());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.CI) {
      throw error;
    }
    console.warn(`[vitest] skipping @vitejs/plugin-react: ${message}`);
  }

  return {
    plugins,
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: [resolve(__dirname, "vitest.setup.ts")],
    },
  };
});
