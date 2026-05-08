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
      // F-A86-05: Ratchet schedule (must increase with each test sprint):
      //   Current floor  → 20 stmts / 15 branch / 20 lines / 15 funcs
      //   Sprint +1      → 30 / 20 / 30 / 20
      //   Sprint +2      → 45 / 35 / 45 / 35
      //   Mid-term goal  → 60 / 50 / 60 / 50  (PHI software minimum)
      //   Long-term goal → 80 / 70 / 70 / 60
      //
      // NEVER lower these thresholds. If a PR reduces coverage, add tests first.
      thresholds: {
        statements: 20,
        branches: 15,
        lines: 20,
        functions: 15,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
