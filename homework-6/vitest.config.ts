import { defineConfig } from "vitest/config";

// Coverage gate: the hard threshold is 80% (push is blocked below this — see the
// pre-push hook). Target is >= 90%. Vitest exits non-zero when any metric falls
// below its threshold, so `npm run coverage` IS the gate check.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: ["agents/**/*.ts", "main.ts"],
      exclude: ["agents/types.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
