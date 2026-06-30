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

// Extract cron expressions from every [triggers] crons array in the file.
// wrangler.toml has THREE crons blocks (top-level/default, [env.production]
// and [env.staging]) and — since Wrangler v4 env blocks do NOT inherit the
// top-level triggers — each must stay in sync with the handler independently.
// Matching only the first block would let a prod/staging cron silently drift.
const cronsBlocks = [...wrangler.matchAll(/crons\s*=\s*\[([\s\S]*?)\]/g)].map((m) => m[1]);

if (cronsBlocks.length === 0) {
  console.error("No cron schedules found in wrangler.toml [triggers].crons");
  process.exit(1);
}

// Union of every declared cron across all blocks (for the wrangler -> handler
// direction) plus the raw blocks (for per-block drift detection).
const declared = [
  ...new Set(cronsBlocks.flatMap((b) => [...b.matchAll(/"([^"]+)"/g)].map((m) => m[1]))),
];

// Check wrangler → handler direction: every declared schedule needs a mapping.
const missingInHandler = declared.filter((c) => !handler.includes(`"${c}"`));
if (missingInHandler.length) {
  console.error(
    "Cron mismatch — these wrangler.toml schedules have no handler mapping:",
    missingInHandler,
  );
  process.exit(1);
}

// Check handler → wrangler direction: extract schedule keys from CRON_ROUTES
const handlerSchedules = [...handler.matchAll(/"([^"]+)":\s/g)]
  .map((m) => m[1])
  .filter((s) => /^[\d*/,\- a-zA-Z]+$/.test(s));

// Every handler schedule must be present in EVERY crons block, so production
// and staging cannot quietly fall out of sync with the default block.
const missingInWrangler: string[] = [];
for (const c of handlerSchedules) {
  cronsBlocks.forEach((block, i) => {
    if (!block.includes(`"${c}"`)) {
      missingInWrangler.push(`"${c}" (crons block #${i + 1})`);
    }
  });
}
if (missingInWrangler.length) {
  console.error(
    "Cron mismatch — these handler schedules are missing from one or more wrangler.toml crons blocks:",
    missingInWrangler,
  );
  process.exit(1);
}

console.log(
  `Cron mapping OK — ${cronsBlocks.length} wrangler crons block(s), ${declared.length} unique ` +
    `schedule(s), ${handlerSchedules.length} handler schedule(s) verified.`,
);
