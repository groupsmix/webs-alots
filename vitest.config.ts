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
