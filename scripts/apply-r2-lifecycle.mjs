#!/usr/bin/env node
/**
 * Apply the native R2 lifecycle rules declared in `r2-lifecycle.json` to a
 * bucket via the Cloudflare REST API.
 *
 * This is Task 3.3.4 — a defense-in-depth backstop independent of the cron
 * cleanup. See docs/r2-lifecycle.md for the rationale and operating notes.
 *
 * Usage:
 *   CLOUDFLARE_ACCOUNT_ID=... \
 *   CLOUDFLARE_API_TOKEN=... \
 *   R2_BUCKET_NAME=webs-alots-uploads-staging \
 *     node scripts/apply-r2-lifecycle.mjs
 *
 * Flags:
 *   --dry-run    Print the request body without calling the API.
 *   --file=PATH  Override the default `r2-lifecycle.json` location.
 *
 * The JSON file is parsed as JSONC-lite: `//` line comments and any object
 * fields whose name starts with `_` are stripped before the request body is
 * POSTed. Rules with `enabled: false` are sent as-is — the API honours the
 * flag. The script is idempotent because PUT replaces the entire rule set.
 *
 * The Cloudflare API endpoint is:
 *   PUT /accounts/{account_id}/r2/buckets/{bucket_name}/lifecycle
 *
 * Docs:
 *   https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/methods/update
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const DEFAULT_CONFIG = resolve(REPO_ROOT, "r2-lifecycle.json");

function parseArgs(argv) {
  const args = { dryRun: false, file: DEFAULT_CONFIG };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") {
      args.dryRun = true;
    } else if (raw.startsWith("--file=")) {
      args.file = resolve(process.cwd(), raw.slice("--file=".length));
    } else if (raw === "--help" || raw === "-h") {
      args.help = true;
    } else {
      console.error(`Unknown argument: ${raw}`);
      process.exit(2);
    }
  }
  return args;
}

function printHelpAndExit() {
  console.log(
    "Usage: node scripts/apply-r2-lifecycle.mjs [--dry-run] [--file=PATH]\n" +
      "\n" +
      "Required env:\n" +
      "  CLOUDFLARE_ACCOUNT_ID   Cloudflare account that owns the R2 bucket\n" +
      "  CLOUDFLARE_API_TOKEN    Token with the R2 Edit permission\n" +
      "  R2_BUCKET_NAME          Target bucket (e.g. webs-alots-uploads-staging)\n",
  );
  process.exit(0);
}

/**
 * Strip `//` line comments and `/* ... *\/` block comments from a JSONC-ish
 * string, being careful not to touch sequences inside double-quoted strings.
 */
function stripComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  let inString = false;
  let escape = false;

  while (i < n) {
    const ch = source[i];

    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i + 2);
      i = nl === -1 ? n : nl;
      continue;
    }

    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Drop any object field whose name starts with `_` (documentation-only). */
function stripDocFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripDocFields);
  }
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const [key, v] of Object.entries(value)) {
      if (key.startsWith("_")) continue;
      result[key] = stripDocFields(v);
    }
    return result;
  }
  return value;
}

function loadConfig(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const stripped = stripComments(raw);
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(
      `Failed to parse ${filePath} as JSONC: ${err.message}. Check for trailing commas.`,
    );
  }
  const cleaned = stripDocFields(parsed);
  if (!cleaned || !Array.isArray(cleaned.rules)) {
    throw new Error(
      `${filePath} must define a top-level "rules" array (got ${typeof cleaned?.rules}).`,
    );
  }
  return cleaned;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value.trim();
}

async function putLifecycle({ accountId, bucketName, apiToken, body }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/r2/buckets/${encodeURIComponent(bucketName)}/lifecycle`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || (parsed && parsed.success === false)) {
    const detail = parsed ? JSON.stringify(parsed.errors ?? parsed, null, 2) : text;
    throw new Error(
      `Cloudflare API returned ${response.status} ${response.statusText}:\n${detail}`,
    );
  }

  return parsed ?? {};
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) printHelpAndExit();

  const config = loadConfig(args.file);
  const ruleCount = config.rules.length;
  const enabledCount = config.rules.filter((r) => r.enabled !== false).length;

  console.log(
    `Loaded ${ruleCount} rule(s) from ${args.file} (${enabledCount} enabled).`,
  );

  if (args.dryRun) {
    console.log("\n--- dry run: request body ---");
    console.log(JSON.stringify(config, null, 2));
    console.log("--- end dry run ---");
    return;
  }

  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const bucketName = requireEnv("R2_BUCKET_NAME");

  console.log(`Applying lifecycle rules to bucket "${bucketName}"...`);
  const result = await putLifecycle({ accountId, bucketName, apiToken, body: config });

  console.log("Cloudflare API acknowledged the update.");
  if (result && typeof result === "object" && "messages" in result) {
    for (const msg of result.messages ?? []) console.log(`  - ${msg}`);
  }
  console.log(
    `\nVerify with:\n  wrangler r2 bucket lifecycle list "${bucketName}"`,
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
