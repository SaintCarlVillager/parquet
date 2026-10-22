import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        statements: 23,
        branches: 68,
      },
    },
  },
});
