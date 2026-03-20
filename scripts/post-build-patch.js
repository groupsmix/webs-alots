#!/usr/bin/env node

/**
 * Post-build patch for the OpenNext Cloudflare output.
 *
 * After `opennextjs-cloudflare build`, the bundled handler.mjs has a
 * patched loadManifest that throws for any manifest not inlined at build time.
 * Next.js 16.2+ calls loadManifest for optional manifests (e.g.
 * subresource-integrity-manifest.json) that may not exist in the build output.
 *
 * This script patches the built handler.mjs so that loadManifest returns
 * undefined for optional/missing manifests instead of throwing.
 */

const fs = require("fs");
const path = require("path");

const HANDLER_PATH = path.join(
  __dirname,
  "..",
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs"
);

if (!fs.existsSync(HANDLER_PATH)) {
  console.error("✘ handler.mjs not found — run opennextjs-cloudflare build first");
  process.exit(1);
}

let content = fs.readFileSync(HANDLER_PATH, "utf-8");

const THROW_PATTERN = 'throw new Error(`Unexpected loadManifest(${';
const REPLACEMENT = 'if(handleMissing)return undefined;throw new Error(`Unexpected loadManifest(${';

if (content.includes(THROW_PATTERN) && !content.includes('if(handleMissing)return undefined;')) {
  content = content.replace(THROW_PATTERN, REPLACEMENT);
  fs.writeFileSync(HANDLER_PATH, content, "utf-8");
  console.log("✓ Patched handler.mjs — optional manifests now return undefined");
} else if (content.includes('if(handleMissing)return undefined;')) {
  console.log("· handler.mjs already patched");
} else {
  console.log("⚠ Could not find loadManifest throw pattern — patch may not be needed");
}
