import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["convex/_lib/**/*.ts"],
      exclude: ["convex/_generated/**"],
      thresholds: {
        statements: 35,
        branches: 25,
        functions: 35,
        lines: 35,
      },
    },
  },
});
