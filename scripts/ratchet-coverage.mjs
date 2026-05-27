#!/usr/bin/env node
/**
 * §3.6 — Coverage ratchet script.
 *
 * After a successful CI run on main, updates .vitest-coverage-floor.json
 * to the actual coverage values (rounded down to nearest 0.5%).
 *
 * Usage:
 *   npx vitest run --coverage
 *   node scripts/ratchet-coverage.mjs
 *
 * This ensures the coverage floor only ever goes UP, never down.
 * If coverage drops below the floor, CI fails via vitest thresholds.
 */

import fs from "node:fs";
import path from "node:path";

const FLOOR_PATH = ".vitest-coverage-floor.json";
const LCOV_PATH = "coverage/lcov.info";

function parseLcov(content) {
  let totalLines = 0;
  let hitLines = 0;
  let totalBranches = 0;
  let hitBranches = 0;
  let totalFunctions = 0;
  let hitFunctions = 0;

  for (const line of content.split("\n")) {
    if (line.startsWith("LF:")) totalLines += parseInt(line.slice(3), 10);
    if (line.startsWith("LH:")) hitLines += parseInt(line.slice(3), 10);
    if (line.startsWith("BRF:")) totalBranches += parseInt(line.slice(4), 10);
    if (line.startsWith("BRH:")) hitBranches += parseInt(line.slice(4), 10);
    if (line.startsWith("FNF:")) totalFunctions += parseInt(line.slice(4), 10);
    if (line.startsWith("FNH:")) hitFunctions += parseInt(line.slice(4), 10);
  }

  const pct = (hit, total) => (total === 0 ? 100 : (hit / total) * 100);

  return {
    statements: pct(hitLines, totalLines),
    branches: pct(hitBranches, totalBranches),
    lines: pct(hitLines, totalLines),
    functions: pct(hitFunctions, totalFunctions),
  };
}

function roundDown(n) {
  return Math.floor(n * 2) / 2; // Round down to nearest 0.5
}

if (!fs.existsSync(LCOV_PATH)) {
  console.error(`No coverage data found at ${LCOV_PATH}. Run 'npx vitest run --coverage' first.`);
  process.exit(1);
}

const lcov = fs.readFileSync(LCOV_PATH, "utf-8");
const actual = parseLcov(lcov);
const current = JSON.parse(fs.readFileSync(FLOOR_PATH, "utf-8"));

const updated = {
  statements: Math.max(current.statements, roundDown(actual.statements)),
  branches: Math.max(current.branches, roundDown(actual.branches)),
  lines: Math.max(current.lines, roundDown(actual.lines)),
  functions: Math.max(current.functions, roundDown(actual.functions)),
};

const changed =
  updated.statements !== current.statements ||
  updated.branches !== current.branches ||
  updated.lines !== current.lines ||
  updated.functions !== current.functions;

if (changed) {
  fs.writeFileSync(FLOOR_PATH, JSON.stringify(updated, null, 2) + "\n");
  console.log("Coverage floor updated:");
  console.log(`  statements: ${current.statements} → ${updated.statements}`);
  console.log(`  branches:   ${current.branches} → ${updated.branches}`);
  console.log(`  lines:      ${current.lines} → ${updated.lines}`);
  console.log(`  functions:  ${current.functions} → ${updated.functions}`);
} else {
  console.log("Coverage floor unchanged — actual coverage has not improved beyond current floor.");
  console.log(`  Current: ${JSON.stringify(current)}`);
  console.log(`  Actual:  statements=${actual.statements.toFixed(1)}%, branches=${actual.branches.toFixed(1)}%, lines=${actual.lines.toFixed(1)}%, functions=${actual.functions.toFixed(1)}%`);
}
