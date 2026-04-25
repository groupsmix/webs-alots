/**
 * CI guard: verify every cron expression declared in wrangler.toml
 * has a matching entry in worker-cron-handler.ts.
 *
 * Prevents silent cron misfires caused by schedule changes in one
 * file but not the other.
 */
import { readFileSync } from "node:fs";

const wrangler = readFileSync("wrangler.toml", "utf8");
const handler = readFileSync("worker-cron-handler.ts", "utf8");

// Extract cron expressions from the *top-level* [triggers] block only.
// Staging/env-specific blocks use identical schedules and are managed separately.
const declared = [
  ...(wrangler.match(/^\s*crons\s*=\s*\[(.*)\]/m)?.[1] ?? "").matchAll(
    /"([^"]+)"/g,
  ),
].map((m) => m[1]);

const missing = declared.filter((c) => !handler.includes(`"${c}"`));

if (missing.length) {
  console.error("Cron mismatch — these wrangler.toml schedules have no handler mapping:", missing);
  process.exit(1);
}

console.log(`Cron mapping OK — ${declared.length} schedule(s) verified.`);
