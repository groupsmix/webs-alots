#!/usr/bin/env node
/**
 * CI-02: Fail-closed bundle budget check.
 *
 * Reads `.next/build-manifest.json` and sums the sizes of the root main
 * chunks and polyfills — the JS loaded on every page. Works with both
 * webpack and Turbopack builds (unlike grepping `next build` output,
 * which Turbopack no longer prints).
 *
 * Exits non-zero if:
 *   - the manifest or referenced files are missing,
 *   - the computed size is 0, or
 *   - the total exceeds BUNDLE_BUDGET_KB (default 1024 kB raw).
 */

import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = ".next/build-manifest.json";
const STATIC_ROOT = ".next";
const BUDGET_KB = Number.parseInt(process.env.BUNDLE_BUDGET_KB ?? "1024", 10);

if (!Number.isFinite(BUDGET_KB) || BUDGET_KB <= 0) {
  console.error(`::error::Invalid BUNDLE_BUDGET_KB: ${process.env.BUNDLE_BUDGET_KB}`);
  process.exit(1);
}

if (!existsSync(MANIFEST)) {
  console.error(`::error::${MANIFEST} not found — build likely failed. Failing closed.`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch (err) {
  console.error(`::error::Could not parse ${MANIFEST}: ${err?.message ?? err}`);
  process.exit(1);
}

const files = [
  ...(Array.isArray(manifest.rootMainFiles) ? manifest.rootMainFiles : []),
  ...(Array.isArray(manifest.polyfillFiles) ? manifest.polyfillFiles : []),
];

if (files.length === 0) {
  console.error("::error::No rootMainFiles or polyfillFiles in build manifest — failing closed.");
  process.exit(1);
}

let totalBytes = 0;
const missing = [];
for (const rel of files) {
  const abs = join(STATIC_ROOT, rel);
  if (!existsSync(abs)) {
    missing.push(rel);
    continue;
  }
  totalBytes += statSync(abs).size;
}

if (missing.length > 0) {
  console.error(`::error::Shared chunk files missing from build output: ${missing.join(", ")}`);
  process.exit(1);
}

if (totalBytes === 0) {
  console.error("::error::Shared bundle size is 0 bytes — failing closed.");
  process.exit(1);
}

const totalKb = Math.round((totalBytes / 1024) * 10) / 10;
console.log(`Shared JS (rootMainFiles + polyfillFiles): ${totalKb} kB (raw)`);
console.log(`Budget: ${BUDGET_KB} kB (raw)`);

if (totalKb > BUDGET_KB) {
  console.error(
    `::error::Bundle size budget exceeded! Shared JS = ${totalKb} kB (limit: ${BUDGET_KB} kB)`,
  );
  process.exit(1);
}

console.log("Bundle budget OK.");
