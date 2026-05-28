#!/usr/bin/env node
/**
 * R-02: Per-file coverage thresholds for security-critical modules.
 *
 * Reads the Vitest JSON coverage summary and enforces minimum coverage
 * for files that handle authentication, encryption, tenant isolation,
 * and rate limiting. Run after `npm run test:coverage`.
 *
 * Usage:
 *   npx vitest run --coverage
 *   node scripts/check-security-coverage.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const COVERAGE_PATH = resolve("coverage/coverage-summary.json");

/** Minimum thresholds per security-critical file (% values). */
const THRESHOLDS = {
  "src/lib/with-auth.ts": { statements: 60, branches: 50 },
  "src/lib/rate-limit.ts": { statements: 50, branches: 40 },
  "src/lib/encryption.ts": { statements: 60, branches: 50 },
  "src/lib/middleware/csrf.ts": { statements: 60, branches: 50 },
  "src/lib/middleware/security-headers.ts": { statements: 50, branches: 40 },
  "src/lib/profile-header-hmac.ts": { statements: 60, branches: 50 },
  "src/lib/tenant-context.ts": { statements: 70, branches: 60 },
  "src/lib/seed-guard.ts": { statements: 60, branches: 50 },
};

if (!existsSync(COVERAGE_PATH)) {
  console.error(
    "❌ Coverage summary not found at coverage/coverage-summary.json\n" +
      "   Run: npx vitest run --coverage",
  );
  process.exit(1);
}

const summary = JSON.parse(readFileSync(COVERAGE_PATH, "utf-8"));
let failures = 0;

for (const [file, thresholds] of Object.entries(THRESHOLDS)) {
  const data = summary[file];
  if (!data) {
    console.warn(`⚠  ${file} — not found in coverage report (not tested?)`);
    continue;
  }

  for (const [metric, min] of Object.entries(thresholds)) {
    const actual = data[metric]?.pct ?? 0;
    if (actual < min) {
      console.error(`❌ ${file}: ${metric} = ${actual.toFixed(1)}% (min: ${min}%)`);
      failures++;
    } else {
      console.log(`✓  ${file}: ${metric} = ${actual.toFixed(1)}% (min: ${min}%)`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} coverage threshold(s) not met.`);
  process.exit(1);
} else {
  console.log("\n✓ All security-critical coverage thresholds met.");
}
