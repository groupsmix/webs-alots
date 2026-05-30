#!/usr/bin/env npx tsx
/**
 * CI guard — A-09: Verify staging and production KV namespace IDs are distinct.
 *
 * Audit finding A-09 (LAUNCH BLOCKER): If staging and production share the same
 * Cloudflare KV namespace IDs, a staging load test exhausts production users'
 * rate-limit token buckets. A k6 test run in staging the day before launch will
 * give all production users 429 errors during peak traffic.
 *
 * This script parses wrangler.toml and fails with a clear error if any KV binding
 * declared under [env.staging.kv_namespaces] shares an `id` or `preview_id` with
 * one declared under [env.production.kv_namespaces] or the top-level [[kv_namespaces]].
 *
 * Run: npx tsx scripts/check-kv-isolation.ts
 * CI:  Add to pre-deploy-check.sh or .github/workflows/ci.yml before wrangler deploy.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const WRANGLER_PATH = join(ROOT, "wrangler.toml");

let wrangler: string;
try {
  wrangler = readFileSync(WRANGLER_PATH, "utf8");
} catch {
  console.error(`[check-kv-isolation] Cannot read wrangler.toml at ${WRANGLER_PATH}`);
  process.exit(1);
}

// ── Parse KV namespace IDs from a TOML section ────────────────────────────

interface KvEntry {
  binding: string;
  id: string;
  preview_id?: string;
  source: string; // section label for error messages
}

/**
 * Extract KV namespace entries from a raw TOML string.
 *
 * We do a simple line-by-line parse rather than pulling in a TOML library:
 * the structure we care about is always:
 *   [[kv_namespaces]] (or [[env.*.kv_namespaces]])
 *   binding    = "NAME"
 *   id         = "abc123"
 *   preview_id = "def456"   (optional)
 *
 * We find each [[*kv_namespaces*]] header and collect the key=value pairs
 * that follow it until the next section header.
 */
function parseKvEntries(toml: string, sectionPattern: RegExp, label: string): KvEntry[] {
  const entries: KvEntry[] = [];
  const lines = toml.split("\n");
  let inSection = false;
  let current: Partial<KvEntry> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect section headers
    if (line.startsWith("[[") || line.startsWith("[")) {
      // Save previous entry if we were in a matching section
      if (inSection && current.binding && current.id) {
        entries.push({ binding: current.binding, id: current.id, preview_id: current.preview_id, source: label });
        current = {};
      }

      const isKvSection = sectionPattern.test(line);
      inSection = isKvSection;
      continue;
    }

    if (!inSection) continue;
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
    if (!match) continue;

    const [, key, value] = match;
    if (key === "binding") current.binding = value;
    else if (key === "id") current.id = value;
    else if (key === "preview_id") current.preview_id = value;
  }

  // Flush last entry
  if (inSection && current.binding && current.id) {
    entries.push({ binding: current.binding, id: current.id, preview_id: current.preview_id, source: label });
  }

  return entries;
}

// Top-level [[kv_namespaces]] (applies to both dev and the default Worker)
const topLevelPattern = /^\[\[kv_namespaces\]\]$/;
// [env.production.kv_namespaces] entries
const prodPattern = /^\[\[env\.production\.kv_namespaces\]\]$/;
// [env.staging.kv_namespaces] entries
const stagingPattern = /^\[\[env\.staging\.kv_namespaces\]\]$/;

const topLevel = parseKvEntries(wrangler, topLevelPattern, "top-level");
const prod = parseKvEntries(wrangler, prodPattern, "env.production");
const staging = parseKvEntries(wrangler, stagingPattern, "env.staging");

// Production is the union of top-level + env.production (env inherits top-level bindings)
const prodIds = new Set<string>();
for (const e of [...topLevel, ...prod]) {
  if (e.id) prodIds.add(e.id);
  if (e.preview_id) prodIds.add(e.preview_id);
}

// ── Compare ────────────────────────────────────────────────────────────────

let failed = false;

for (const stagingEntry of staging) {
  const collisions: string[] = [];

  if (stagingEntry.id && prodIds.has(stagingEntry.id)) {
    collisions.push(`id="${stagingEntry.id}"`);
  }
  if (stagingEntry.preview_id && prodIds.has(stagingEntry.preview_id)) {
    collisions.push(`preview_id="${stagingEntry.preview_id}"`);
  }

  if (collisions.length > 0) {
    console.error(
      `\n[A-09 LAUNCH BLOCKER] KV namespace "${stagingEntry.binding}" in [env.staging.kv_namespaces] ` +
      `shares ${collisions.join(" and ")} with the production namespace.\n` +
      `\nFix: provision a dedicated staging namespace:\n` +
      `   wrangler kv:namespace create RATE_LIMIT_KV_STAGING\n` +
      `   wrangler kv:namespace create RATE_LIMIT_KV_STAGING --preview\n` +
      `Then replace the id/preview_id in [env.staging.kv_namespaces] in wrangler.toml.\n`,
    );
    failed = true;
  }
}

if (staging.length === 0) {
  console.error(
    "\n[A-09 WARNING] No [env.staging.kv_namespaces] entries found in wrangler.toml.\n" +
    "If staging uses the top-level KV namespace implicitly, it shares production counters.\n" +
    "Provision a dedicated staging KV namespace and declare it explicitly.\n",
  );
  // Warn but don't fail — the block may not be declared yet
}

if (failed) {
  process.exit(1);
}

if (staging.length > 0) {
  console.log(
    `[check-kv-isolation] ✓ All ${staging.length} staging KV namespace(s) use distinct IDs from production.`,
  );
}

process.exit(0);
