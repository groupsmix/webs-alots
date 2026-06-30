import path from "path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Dedicated Vitest config for Storybook component tests (the @storybook/addon-vitest
// integration). It is intentionally SEPARATE from the root vitest.config.ts so that:
//   1. The existing unit / RLS / E2E / coverage runs (which call `vitest` directly)
//      never accidentally boot the Playwright browser this config requires.
//   2. Story tests can be run in isolation via `npm run test-storybook`.
//
// This config transforms every story into a component test, renders it in a real
// browser (Playwright/Chromium) and — via the a11y annotations wired in
// .storybook/vitest.setup.ts plus `parameters.a11y.test` in preview.tsx — runs
// axe accessibility checks against each story.
//
// Note: Vitest 4 replaced the legacy `provider: "playwright"` string with the
// provider function exported from the standalone @vitest/browser-playwright package.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [storybookTest({ configDir: path.join(__dirname, ".storybook") })],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    setupFiles: [".storybook/vitest.setup.ts"],
  },
});
