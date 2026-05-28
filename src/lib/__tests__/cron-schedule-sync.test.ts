/**
 * H-07: Verify that worker-cron-handler.ts CRON_ROUTES and wrangler.toml
 * [triggers].crons declare the exact same set of cron expressions.
 *
 * Drift between these two lists causes silent cron failures: Cloudflare
 * fires the cron, the handler logs "Unknown cron expression", and no
 * Sentry alert fires.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

function parseWranglerCrons(): string[] {
  const content = readFileSync(resolve(__dirname, "../../../wrangler.toml"), "utf-8");
  const cronsMatch = content.match(/\[triggers\]\s*\ncrons\s*=\s*\[([\s\S]*?)\]/);
  if (!cronsMatch) throw new Error("Could not find [triggers].crons in wrangler.toml");
  const lines = cronsMatch[1].split("\n");
  return lines
    .map((line) => {
      const match = line.match(/"([^"]+)"/);
      return match ? match[1] : null;
    })
    .filter((v): v is string => v !== null)
    .sort();
}

function getHandlerCrons(): string[] {
  // Dynamic import won't work because the file imports .open-next/worker.js.
  // Instead, read the file and extract the CRON_ROUTES keys via regex.
  const content = readFileSync(resolve(__dirname, "../../../worker-cron-handler.ts"), "utf-8");
  const routesMatch = content.match(/(?:export\s+)?const\s+CRON_ROUTES[\s\S]*?=\s*\{([\s\S]*?)\};/);
  if (!routesMatch) throw new Error("Could not find CRON_ROUTES in worker-cron-handler.ts");
  const keys: string[] = [];
  const keyRegex = /"([^"]+)":\s*\[/g;
  let m;
  while ((m = keyRegex.exec(routesMatch[1])) !== null) {
    keys.push(m[1]);
  }
  return keys.sort();
}

describe("Cron schedule synchronization", () => {
  it("wrangler.toml crons match CRON_ROUTES keys exactly", () => {
    const wranglerCrons = parseWranglerCrons();
    const handlerCrons = getHandlerCrons();

    expect(wranglerCrons).toEqual(handlerCrons);
  });

  it("every CRON_ROUTES entry maps to at least one route", () => {
    const content = readFileSync(resolve(__dirname, "../../../worker-cron-handler.ts"), "utf-8");
    const routesMatch = content.match(
      /(?:export\s+)?const\s+CRON_ROUTES[\s\S]*?=\s*\{([\s\S]*?)\};/,
    );
    if (!routesMatch) throw new Error("Could not find CRON_ROUTES");

    const entryRegex = /"[^"]+"\s*:\s*\[([^\]]+)\]/g;
    let m;
    while ((m = entryRegex.exec(routesMatch[1])) !== null) {
      const routes = m[1].match(/"\/api\/cron\/[^"]+"/g);
      expect(routes?.length).toBeGreaterThan(0);
    }
  });
});
