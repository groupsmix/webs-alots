#!/usr/bin/env node
/**
 * CI guard: ADR 0013 — Operations-First Scope Enforcement.
 *
 * Verifies that every Architecture-B API route handler (clinical, ADT,
 * restaurant, veterinary) contains a scope-gating check. Specifically,
 * each `route.ts` file under a gated API group directory MUST contain
 * either:
 *   - `isGatedApiGroupEnabled` (the canonical enforcement helper), OR
 *   - `isFeatureEnabled` with one of the gated flags, OR
 *   - `@scope-gate-exempt` comment (for routes that are intentionally
 *     ungated, e.g. public read-only discovery endpoints)
 *
 * If a gated route handler has no gating check, CI fails.
 *
 * Mirrors `scripts/check-mvp-scope-refs.mjs` in structure.
 *
 * @see docs/adr/0013-operations-first-scope.md
 * @see src/lib/config/verticals.ts — VERTICAL_SCOPES / ALL_GATED_API_GROUPS
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const API_DIR = join(ROOT, "src", "app", "api");

// These API groups are gated per ADR 0013. Must match VERTICAL_SCOPES in
// src/lib/config/verticals.ts. Kept as a static list so this script has
// zero runtime dependencies (runs before `npm install` in some CI setups).
const GATED_API_GROUPS = [
  "prescriptions",
  "vitals",
  "radiology",
  "insurance-claims",
  "admissions",
  "pets",
  "menus",
  "restaurant-orders",
  "restaurant-tables",
];

// Patterns that indicate a scope-gating check is present
const GATE_PATTERNS = [
  /assertScopeGate/,
  /isGatedApiGroupEnabled/,
  /isFeatureEnabled\s*\(/,
  /isApiGroupEnabled/,
  /@scope-gate-exempt/,
  /SCOPE_GATE_EXEMPT/,
];

/**
 * Recursively find all route.ts files under a directory.
 */
function findRouteFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      results.push(fullPath);
    }
  }
  return results;
}

let failures = 0;
let checked = 0;

for (const group of GATED_API_GROUPS) {
  const groupDir = join(API_DIR, group);
  if (!existsSync(groupDir) || !statSync(groupDir).isDirectory()) {
    // Group directory doesn't exist — not a failure (may have been removed)
    continue;
  }

  const routeFiles = findRouteFiles(groupDir);
  for (const routeFile of routeFiles) {
    checked++;
    const content = readFileSync(routeFile, "utf-8");
    const hasGate = GATE_PATTERNS.some((pattern) => pattern.test(content));

    if (!hasGate) {
      const relPath = relative(ROOT, routeFile);
      console.error(
        `FAIL: ${relPath} — gated API group "${group}" route has no scope-enforcement check.`,
      );
      console.error(
        `      Add isGatedApiGroupEnabled("${group}", featuresConfig) or mark @scope-gate-exempt`,
      );
      failures++;
    }
  }
}

console.log(`\nScope enforcement check: ${checked} route files scanned, ${failures} failure(s).`);

if (failures > 0) {
  console.error("\nFix: Add `isGatedApiGroupEnabled()` calls to the failing routes, or mark");
  console.error("them `// @scope-gate-exempt` if they are intentionally public.");
  console.error("See: docs/adr/0013-operations-first-scope.md\n");
  process.exit(1);
}

console.log("All gated API routes have scope enforcement. OK.\n");
