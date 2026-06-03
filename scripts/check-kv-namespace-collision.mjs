#!/usr/bin/env node
/**
 * CI guard for A-09 / A31-A60 Top Finding #1 (CRIT).
 *
 * Two failure modes:
 *   COLLISION: staging RATE_LIMIT_KV id equals production id.
 *              ALWAYS a hard fail. This is the original A-09 bug.
 *   PLACEHOLDER: staging id is still REPLACE_BEFORE_STAGING_DEPLOY_*.
 *                Hard fail only with --strict (deploy mode). In lint
 *                mode this is a warning because the placeholder is
 *                the legitimate intermediate state between landing
 *                the audit fix and provisioning the real staging KV.
 *
 * Usage:
 *   bun run scripts/check-kv-namespace-collision.mjs           # lint
 *   bun run scripts/check-kv-namespace-collision.mjs --strict  # deploy
 *
 * Hooked into .github/workflows/ci.yml under the "guards" stage.
 */
const STRICT = process.argv.includes("--strict");

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRANGLER_PATH = resolve(process.cwd(), "wrangler.toml");

const text = readFileSync(WRANGLER_PATH, "utf8");

// Split the file into top-level + per-env sections by [[ ... ]] / [ ... ]
// We don't pull in a full TOML parser because we only need to scan two
// kv_namespaces blocks (top-level for prod, env.staging.kv_namespaces
// for staging) and the lossy regex pass is sufficient + dep-free.
function extractKvBlocks(input) {
  const blocks = [];
  const re = /\[\[(env\.[a-z]+\.)?kv_namespaces\]\][\s\S]*?(?=\n\[|\n*$)/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    blocks.push({ scope: m[1] ?? "prod.", body: m[0] });
  }
  return blocks;
}

function pick(body, key) {
  const re = new RegExp(`${key}\\s*=\\s*"([^"]+)"`);
  const m = body.match(re);
  return m ? m[1] : null;
}

const blocks = extractKvBlocks(text);
const rateLimit = blocks
  .map((b) => ({
    scope: b.scope.replace(/^env\.|\.$/g, "") || "production",
    binding: pick(b.body, "binding"),
    id: pick(b.body, "\\bid"),
    preview_id: pick(b.body, "preview_id"),
  }))
  .filter((b) => b.binding === "RATE_LIMIT_KV");

const prod = rateLimit.find((b) => b.scope === "production");
const staging = rateLimit.find((b) => b.scope === "staging");

const errors = [];
const warnings = [];

if (!prod) {
  errors.push("Could not locate production RATE_LIMIT_KV namespace in wrangler.toml");
}
if (!staging) {
  errors.push("Could not locate env.staging RATE_LIMIT_KV namespace in wrangler.toml");
}

const placeholderId = staging?.id?.startsWith("REPLACE_BEFORE_STAGING_DEPLOY");
const placeholderPreview = staging?.preview_id?.startsWith("REPLACE_BEFORE_STAGING_DEPLOY");

if (placeholderId) {
  (STRICT ? errors : warnings).push(
    "Staging RATE_LIMIT_KV id is still a placeholder. Run scripts/create-staging-kv.sh before deploying staging.",
  );
}
if (placeholderPreview) {
  (STRICT ? errors : warnings).push(
    "Staging RATE_LIMIT_KV preview_id is still a placeholder. Run scripts/create-staging-kv.sh before deploying staging.",
  );
}

// Only check collision when neither side is a placeholder — comparing
// a placeholder to a real id is not a collision, just an unfinished fix.
if (!placeholderId && prod && staging && prod.id && staging.id && prod.id === staging.id) {
  errors.push(
    `Staging RATE_LIMIT_KV id (${staging.id}) is identical to production. ` +
      "This is the A-09 collision bug. Run scripts/create-staging-kv.sh.",
  );
}
if (
  !placeholderPreview &&
  prod &&
  staging &&
  prod.preview_id &&
  staging.preview_id &&
  prod.preview_id === staging.preview_id
) {
  errors.push(
    `Staging RATE_LIMIT_KV preview_id (${staging.preview_id}) is identical to production. ` +
      "Run scripts/create-staging-kv.sh.",
  );
}

for (const w of warnings) console.warn("⚠ " + w);

if (errors.length > 0) {
  console.error("❌ KV namespace collision check failed:");
  for (const e of errors) console.error("  • " + e);
  process.exit(1);
}

const mode = STRICT ? "strict" : "lint";
console.log(`✅ KV namespace collision check passed (${mode} mode).`);
if (prod && !placeholderId) {
  console.log(`   prod    id=${prod.id?.slice(0, 8)}… preview=${prod.preview_id?.slice(0, 8)}…`);
}
if (staging && !placeholderId) {
  console.log(
    `   staging id=${staging.id?.slice(0, 8)}… preview=${staging.preview_id?.slice(0, 8)}…`,
  );
}
