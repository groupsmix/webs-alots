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
      // A86-F05: Ratcheted from single-digit floors (8/6/8/5) to just below
      // the current measured coverage so regressions are caught immediately.
      // These MUST be ratcheted upward as new tests land; the long-term
      // aspirational targets are statements: 80, branches: 70, lines: 70,
      // functions: 60. For PHI software, the mid-term milestone is
      // 60/50/60/50 per A86-F05.
      thresholds: {
        statements: 12,
        branches: 9,
        lines: 12,
        functions: 8,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
