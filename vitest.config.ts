import fs from "fs";
import path from "path";
import { defineConfig } from "vitest/config";

// FE-006: Read coverage thresholds from a ratchet file so they can be
// mechanically bumped upward per merged PR. Long-term targets:
// statements: 80, branches: 70, lines: 70, functions: 60.
const floorPath = path.resolve(__dirname, ".vitest-coverage-floor.json");
const floor = JSON.parse(fs.readFileSync(floorPath, "utf-8")) as {
  statements: number;
  branches: number;
  lines: number;
  functions: number;
};

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
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
      exclude: ["src/lib/types/**", "src/app/api/docs/**"],
      thresholds: floor,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
