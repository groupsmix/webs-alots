#!/usr/bin/env node

/**
 * Post-build patch for the OpenNext Cloudflare output.
 *
 * Two patches are applied to .open-next/server-functions/default/handler.mjs:
 *
 * 1. loadManifest optional-manifest tolerance
 *    Next.js 16.2+ calls loadManifest for optional manifests (e.g.
 *    subresource-integrity-manifest.json) that may not exist in the
 *    build output. OpenNext's bundled handler throws in that case;
 *    we make it return undefined instead.
 *
 * 2. @vercel/og bundle exclusion (PR #973, CF-BUNDLE-01)
 *    Turbopack emits an `externalImport` function with a hardcoded
 *    switch case redirecting `@vercel/og/index.node.js` to
 *    `@vercel/og/index.edge.js`, even when no app code uses
 *    `ImageResponse` / `next/og`. Wrangler statically follows that
 *    import path and uploads resvg.wasm (1.4 MB) + yoga.wasm (70 KB)
 *    + index.edge.js with the worker — ~540 KiB compressed — pushing
 *    us over Cloudflare's 10 MiB compressed Worker limit. Since no
 *    src/ code references ImageResponse, we neutralize the case so
 *    wrangler stops bundling the WASM. If someone later adds OG image
 *    generation, this throws a clear runtime error.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HANDLER_PATH = path.join(
  __dirname,
  "..",
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs",
);

if (!fs.existsSync(HANDLER_PATH)) {
  console.error("✘ handler.mjs not found — run opennextjs-cloudflare build first");
  process.exit(1);
}

let content = fs.readFileSync(HANDLER_PATH, "utf-8");
let mutated = false;

// ── Patch 1: loadManifest optional-manifest tolerance ────────────────
{
  const THROW_PATTERN = "throw new Error(`Unexpected loadManifest(${";
  const REPLACEMENT =
    "if(handleMissing)return undefined;throw new Error(`Unexpected loadManifest(${";

  if (content.includes(THROW_PATTERN) && !content.includes("if(handleMissing)return undefined;")) {
    content = content.replaceAll(THROW_PATTERN, REPLACEMENT);
    mutated = true;
    console.log("✓ Patched handler.mjs — optional manifests now return undefined");
  } else if (content.includes("if(handleMissing)return undefined;")) {
    console.log("· loadManifest patch already applied");
  } else {
    console.log("⚠ Could not find loadManifest throw pattern — patch may not be needed");
  }
}

// ── Patch 2: @vercel/og bundle exclusion (CF-BUNDLE-01) ──────────────
{
  // Turbopack emits either:
  //   case"next/dist/compiled/@vercel/og/index.node.js":raw=await import("next/dist/compiled/@vercel/og/index.edge.js");break;
  // or (since opennextjs-cloudflare 1.18+) the case already resolves to
  // an OpenNext shim that throws "OpenNext shim". In that case the bundle
  // is already neutralized and no further patch is needed.
  const OG_LEGACY_PATTERN =
    'case"next/dist/compiled/@vercel/og/index.node.js":raw=await import("next/dist/compiled/@vercel/og/index.edge.js");break;';
  const OG_LEGACY_REPLACEMENT =
    'case"next/dist/compiled/@vercel/og/index.node.js":throw new Error("ImageResponse/@vercel/og is not bundled in this Worker build (CF-BUNDLE-01). Re-enable in scripts/post-build-patch.mjs if needed.");break;';
  const OG_SHIM_PATTERN =
    'case"next/dist/compiled/@vercel/og/index.node.js":raw=await Promise.resolve().then(()=>(init_throw(),throw_exports));break;';
  const OG_SHIM_REPLACEMENT =
    'case"next/dist/compiled/@vercel/og/index.node.js":throw new Error("ImageResponse/@vercel/og is not bundled in this Worker build (CF-BUNDLE-01). Re-enable in scripts/post-build-patch.mjs if needed.");break;';
  const OG_MARKER = "ImageResponse/@vercel/og is not bundled in this Worker build";
  const OG_SHIM_MARKER = "OpenNext shim";

  const legacyOccurrences = content.split(OG_LEGACY_PATTERN).length - 1;
  const shimOccurrences = content.split(OG_SHIM_PATTERN).length - 1;
  if (legacyOccurrences > 0 && !content.includes(OG_MARKER)) {
    content = content.replaceAll(OG_LEGACY_PATTERN, OG_LEGACY_REPLACEMENT);
    mutated = true;
    console.log(
      `✓ Patched handler.mjs — @vercel/og legacy import neutralized (${legacyOccurrences} site(s))`,
    );
  } else if (shimOccurrences > 0 && !content.includes(OG_MARKER)) {
    content = content.replaceAll(OG_SHIM_PATTERN, OG_SHIM_REPLACEMENT);
    mutated = true;
    console.log(`✓ Patched handler.mjs — @vercel/og shim neutralized (${shimOccurrences} site(s))`);
  } else if (content.includes(OG_MARKER)) {
    console.log("· @vercel/og patch already applied");
  } else if (
    content.includes('case"next/dist/compiled/@vercel/og/index.node.js"') &&
    content.includes(OG_SHIM_MARKER)
  ) {
    console.log("· @vercel/og is already neutralized by the OpenNext shim");
  } else if (!content.includes('"next/dist/compiled/@vercel/og/index.node.js"')) {
    console.log("· No @vercel/og import found in handler.mjs");
  } else {
    console.log(
      "⚠ Could not find @vercel/og externalImport pattern — Turbopack output may have changed",
    );
  }
}

if (mutated) {
  fs.writeFileSync(HANDLER_PATH, content, "utf-8");
}
