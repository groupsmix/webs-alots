#!/usr/bin/env node
/**
 * INF-01: Verify that the built worker handler exports a `scheduled` function.
 *
 * OpenNext on Cloudflare Workers requires a `scheduled` export in the
 * default server function handler for cron triggers to work. If this
 * export is missing, all cron jobs silently fail in production.
 *
 * Usage (CI):
 *   node scripts/verify-cron-export.mjs
 *
 * Requires a successful build — checks .open-next/server-functions/default/handler.mjs.
 * Falls back to checking worker-cron-handler.ts source if .open-next is unavailable.
 */

import { existsSync, readFileSync } from "node:fs";

const HANDLER_PATH = ".open-next/server-functions/default/handler.mjs";
const SOURCE_PATH = "worker-cron-handler.ts";

function checkBuiltHandler() {
  if (!existsSync(HANDLER_PATH)) {
    return null; // not built yet, fall back to source check
  }
  const content = readFileSync(HANDLER_PATH, "utf-8");
  if (/export\s+.*scheduled/s.test(content) || /exports\.scheduled/.test(content)) {
    return true;
  }
  return false;
}

function checkSourceHandler() {
  if (!existsSync(SOURCE_PATH)) {
    console.error(`::error::${SOURCE_PATH} not found — cron handler source missing.`);
    process.exit(1);
  }
  const content = readFileSync(SOURCE_PATH, "utf-8");
  if (/export\s+.*scheduled/s.test(content)) {
    console.log(`✓ ${SOURCE_PATH} contains 'scheduled' export (source check).`);
    return true;
  }
  console.error(
    `::error::${SOURCE_PATH} does not export a 'scheduled' function. Cron jobs will not fire.`
  );
  return false;
}

const builtResult = checkBuiltHandler();

if (builtResult === true) {
  console.log(`✓ ${HANDLER_PATH} contains 'scheduled' export.`);
  process.exit(0);
} else if (builtResult === false) {
  console.error(
    `::error::${HANDLER_PATH} does NOT contain a 'scheduled' export. Cron triggers will silently fail.`
  );
  process.exit(1);
}

// Fallback: check source when .open-next doesn't exist (e.g., lint-only CI)
if (!checkSourceHandler()) {
  process.exit(1);
}
