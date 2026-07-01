import fs from "fs";
import path from "path";
import { defineConfig } from "vitest/config";

// FE-006: Read coverage thresholds from a ratchet file so they can be
// mechanically bumped upward per merged PR. Long-term targets:
// statements: 80, branches: 70, lines: 70, functions: 60.
const floorPath = path.resolve(__dirname, ".vitest-coverage-floor.json");
const floorFile = JSON.parse(fs.readFileSync(floorPath, "utf-8")) as {
  statements: number;
  branches: number;
  lines: number;
  functions: number;
  // The ratchet file also carries a `target` object documenting the
  // long-term goals. It must NOT be forwarded to Vitest: any non-metric key
  // in `coverage.thresholds` is interpreted as a per-glob threshold, so
  // `target` would become a glob that matches no files (ignored at best,
  // a "no files for threshold glob" error at worst). Pick only the metrics.
  target?: unknown;
};
const floor = {
  statements: floorFile.statements,
  branches: floorFile.branches,
  lines: floorFile.lines,
  functions: floorFile.functions,
};

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Zod 4 re-exports `z` via `import * as z; export { z }` which Vite's
    // ESM module loader strips during transform unless the package is
    // inlined. Without this, `import { z } from "zod"` resolves to
    // `undefined` and every schema-using test explodes.
    server: {
      deps: {
        inline: ["zod"],
      },
    },
    // DI-HIGH-04: Clear mocks globally to prevent inter-test state leakage.
    // Previously 10+ test files had incomplete beforeEach cleanup.
    clearMocks: true,
    testTimeout: 15000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/components/__tests__/setup.tsx"],
    setupFiles: ["./src/components/__tests__/setup.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: [
        "src/lib/**/*.ts",
        "src/components/**/*.tsx",
        "src/app/api/**/*.ts",
        "src/app/api/**/*.tsx",
      ],
      exclude: ["src/lib/types/**", "src/app/api/docs/**", "src/components/landing/oltigo/**"],
      thresholds: floor,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
