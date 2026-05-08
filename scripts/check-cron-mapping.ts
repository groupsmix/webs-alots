/**
 * CI guard: verify every cron expression declared in wrangler.toml
 * has a matching entry in worker-cron-handler.ts.
 *
 * Prevents silent cron misfires caused by schedule changes in one
 * file but not the other.
 *
 * Bug fix: the previous version used `.match()` (returns only the FIRST
 * match even with the `m` flag), so only the first `crons = [...]` line
 * was checked — all subsequent crons silently passed CI unchecked.
 * Now uses `.matchAll()` with the `gm` flag to find ALL cron lines.
 */
import { readFileSync } from "node:fs";

const wrangler = readFileSync("wrangler.toml", "utf8");
const handler = readFileSync("worker-cron-handler.ts", "utf8");

// Extract ALL cron expressions from wrangler.toml using matchAll (gm flags).
// Each [[triggers.crons]] block has its own `crons = [...]` line.
const declared: string[] = [];
for (const lineMatch of wrangler.matchAll(/^\s*crons\s*=\s*\[(.*)\]/gm)) {
  for (const cronMatch of lineMatch[1].matchAll(/"([^"]+)"/g)) {
    declared.push(cronMatch[1]);
  }
}

if (declared.length === 0) {
  console.error("check-cron-mapping: no cron expressions found in wrangler.toml — check the regex");
  process.exit(1);
}

const missing = declared.filter((c) => !handler.includes(`"${c}"`));

if (missing.length) {
  console.error(
    `Cron mismatch — ${missing.length} wrangler.toml schedule(s) have no handler mapping:`,
    missing,
  );
  console.error("Add the missing entries to CRON_ROUTES in worker-cron-handler.ts");
  process.exit(1);
}

console.log(`Cron mapping OK — ${declared.length} schedule(s) verified.`);
