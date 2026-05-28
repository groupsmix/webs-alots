/**
 * CI guard: verify every /api/cron/ route handler calls `verifyCronSecret`
 * before any side effects. Prevents CSRF-exempt cron routes from being
 * created without authentication checks.
 *
 * W8-A-02 / W8-A56-02: Mirrors the existing scripts/check-cron-mapping.ts pattern.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CRON_DIR = "src/app/api/cron";

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.js") {
      results.push(full);
    }
  }
  return results;
}

const routeFiles = findRouteFiles(CRON_DIR);

if (routeFiles.length === 0) {
  console.error(`No cron route files found under ${CRON_DIR}/`);
  process.exit(1);
}

const missing: string[] = [];

for (const file of routeFiles) {
  const content = readFileSync(file, "utf8");
  if (!content.includes("verifyCronSecret")) {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error("Cron auth guard violation — these cron routes do not call verifyCronSecret():");
  for (const f of missing) {
    console.error(`  ${f}`);
  }
  console.error(
    "\nEvery src/app/api/cron/**/route.ts must call verifyCronSecret() before any side effects.",
  );
  process.exit(1);
}

console.log(`✓ All ${routeFiles.length} cron routes call verifyCronSecret()`);
