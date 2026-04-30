import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/components/__tests__/setup.tsx"],
    setupFiles: ["./src/components/__tests__/setup.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/lib/**/*.ts",
        "src/components/**/*.tsx",
        "src/app/api/**/*.ts",
        "src/app/api/**/*.tsx",
      ],
      exclude: ["src/lib/types/**", "src/app/api/docs/**"],
      // CI-08: Enforce coverage thresholds; CI step fails if not met.
      //
      // These are *baseline* thresholds set just below the current measured
      // coverage of the repo. The job is now blocking, so any change that
      // drops coverage below these floors will fail CI. The numbers should
      // be ratcheted upward as coverage improves; the long-term aspirational
      // targets are statements: 80, branches: 70, lines: 70, functions: 60.
      thresholds: {
        statements: 8,
        branches: 6,
        lines: 8,
        functions: 5,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
