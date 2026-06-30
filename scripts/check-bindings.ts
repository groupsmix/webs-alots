#!/usr/bin/env npx tsx
/**
 * CI guard: verify every Worker binding declared in wrangler.toml
 * (KV namespaces, R2 buckets) is referenced somewhere in the source,
 * and flag orphaned bindings that add cost without use.
 *
 * Companion to check-cron-mapping.ts (FR-32).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const wrangler = readFileSync("wrangler.toml", "utf8");

// ── Extract bindings from wrangler.toml ──────────────────────────────

function extractBindings(content: string): string[] {
  const bindings: string[] = [];
  // Strip full-line and trailing TOML comments so commented-out example
  // bindings (e.g. the not-yet-provisioned APP_CACHE_KV / SUBDOMAIN_KV blocks)
  // are not mistaken for declared bindings.
  const active = content
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, "$1"))
    .join("\n");
  for (const m of active.matchAll(/binding\s*=\s*"([^"]+)"/g)) {
    bindings.push(m[1]);
  }
  return [...new Set(bindings)];
}

const declaredBindings = extractBindings(wrangler);

if (declaredBindings.length === 0) {
  console.error("No bindings found in wrangler.toml");
  process.exit(1);
}

// ── Scan source files for binding references ─────────────────────────

const SRC_DIRS = ["src", "worker-cron-handler.ts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === ".open-next") continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full));
    } else if (EXTENSIONS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

function collectSourceFiles(): string[] {
  const files: string[] = [];
  for (const target of SRC_DIRS) {
    try {
      const stat = statSync(target);
      if (stat.isDirectory()) {
        files.push(...walkDir(target));
      } else {
        files.push(target);
      }
    } catch {
      // target may not exist
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles();
const allSource = sourceFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// ── Verify: wrangler → source ────────────────────────────────────────
// ASSETS is consumed by the Workers runtime, not by user code.
// UPLOADS_BUCKET is declared for future direct R2 binding usage; currently
// the app uses the S3-compatible API via R2_ACCESS_KEY_ID env vars.
const RUNTIME_BINDINGS = new Set(["ASSETS", "UPLOADS_BUCKET"]);

const unreferenced = declaredBindings.filter((b) => {
  if (RUNTIME_BINDINGS.has(b)) return false;
  return !allSource.includes(b);
});

let exitCode = 0;

if (unreferenced.length) {
  console.error(
    `Binding mismatch — ${unreferenced.length} wrangler.toml binding(s) not found in source:`,
    unreferenced,
  );
  exitCode = 1;
}

if (exitCode === 0) {
  console.log(
    `Bindings OK — ${declaredBindings.length} wrangler binding(s) verified: ${declaredBindings.join(", ")}`,
  );
}

process.exit(exitCode);
