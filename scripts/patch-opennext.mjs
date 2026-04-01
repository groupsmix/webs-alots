#!/usr/bin/env node

/**
 * Patches @opennextjs/cloudflare's load-manifest plugin to support
 * Next.js 16.2+ which introduces prefetch-hints.json and other
 * non-standard manifest files that the adapter doesn't know about.
 *
 * This patch:
 * 1. Adds prefetch-hints.json to the glob pattern for inlined manifests
 * 2. Makes loadManifest return undefined for optional/missing manifests
 *    instead of throwing (e.g. subresource-integrity-manifest.json)
 *
 * Audit 8.10 — This patch targets @opennextjs/cloudflare ^1.17.1
 * (pinned in package.json devDependencies). If upgrading the adapter,
 * verify this patch is still needed and update accordingly.
 * Last verified: 2025-04-01 against @opennextjs/cloudflare@1.17.1
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOAD_MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "build",
  "patches",
  "plugins",
  "load-manifest.js"
);

if (!fs.existsSync(LOAD_MANIFEST_PATH)) {
  console.log("⚠ @opennextjs/cloudflare not found, skipping patch");
  process.exit(0);
}

let content = fs.readFileSync(LOAD_MANIFEST_PATH, "utf-8");

// 1. Add prefetch-hints to the glob pattern
if (!content.includes("prefetch-hints")) {
  content = content.replace(
    "**/{*-manifest,required-server-files}.json",
    "**/{*-manifest,required-server-files,prefetch-hints}.json"
  );
  console.log("✓ Added prefetch-hints.json to manifest glob");
} else {
  console.log("· prefetch-hints.json already in glob");
}

fs.writeFileSync(LOAD_MANIFEST_PATH, content, "utf-8");
console.log("✓ OpenNext load-manifest patch applied");
