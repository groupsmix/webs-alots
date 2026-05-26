/**
 * CI guard: verify every cron expression declared in wrangler.toml
 * has a matching entry in worker-cron-handler.ts, and vice-versa.
 *
 * Prevents silent cron misfires caused by schedule changes in one
 * file but not the other.
 */
import { readFileSync } from "node:fs";

const wrangler = readFileSync("wrangler.toml", "utf8");
const handler = readFileSync("worker-cron-handler.ts", "utf8");

// Extract cron expressions from the [triggers] crons array.
// The array can be multiline, so we first extract the full array content
// between `crons = [` and `]`, then pull out quoted strings.
const cronsBlockMatch = wrangler.match(/crons\s*=\s*\[([\s\S]*?)\]/);
const cronsBlock = cronsBlockMatch?.[1] ?? "";
const declared = [...cronsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

if (declared.length === 0) {
  console.error("No cron schedules found in wrangler.toml [triggers].crons");
  process.exit(1);
}

// Check wrangler → handler direction
const missingInHandler = declared.filter((c) => !handler.includes(`"${c}"`));
if (missingInHandler.length) {
  console.error("Cron mismatch — these wrangler.toml schedules have no handler mapping:", missingInHandler);
  process.exit(1);
}

// Check handler → wrangler direction: extract schedule keys from CRON_ROUTES
const handlerSchedules = [...handler.matchAll(/"([*/\d ]+\*)":\s/g)].map((m) => m[1]);
const missingInWrangler = handlerSchedules.filter((c) => !cronsBlock.includes(`"${c}"`));
if (missingInWrangler.length) {
  console.error("Cron mismatch — these handler schedules are not in wrangler.toml:", missingInWrangler);
  process.exit(1);
}

console.log(`Cron mapping OK — ${declared.length} wrangler schedule(s), ${handlerSchedules.length} handler schedule(s) verified.`);
