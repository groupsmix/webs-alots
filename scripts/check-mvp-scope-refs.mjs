#!/usr/bin/env node
/**
 * CI guard for Audit Task 5 (feature-flag governance).
 *
 * MVP_SCOPE.md is the scope-control document auditors and regulators read to
 * understand how experimental verticals / advanced AI are gated. The original
 * audit found it describing gating mechanisms (env helpers) that no longer
 * existed in code. This guard prevents that class of drift from recurring:
 *
 *   Every code-like anchor MVP_SCOPE.md names — function (`isAIEnabled()`),
 *   env var (`AI_DISABLED`), KV binding (`FEATURE_FLAGS_KV`), table
 *   (`clinic_types`), type (`ClinicFeatureKey`), or file path
 *   (`src/lib/features.ts`) — MUST still resolve to at least one real
 *   occurrence in the tracked source tree. If a referenced symbol is renamed
 *   or deleted without updating the doc, CI fails here.
 *
 * It does NOT try to enforce the inverse (every code flag must be documented)
 * — that would be noisy and is not the finding. It only catches the doc
 * referencing things that have ceased to exist.
 *
 * Dep-free: uses `git grep` (tracked files only, so node_modules is ignored)
 * and fs existence checks. Glob-style tokens (containing `*`) and prose are
 * skipped by construction.
 *
 * Usage:   bun run scripts/check-mvp-scope-refs.mjs
 * Hooked into .github/workflows/ci.yml.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = process.cwd();
const DOC = "MVP_SCOPE.md";

// Tokens that match the code-identifier shape but are English/SQL keywords or
// otherwise not symbols we expect to grep for. Extend deliberately.
const SKIP = new Set([
  "JSONB",
  "true",
  "false",
  "null",
  "AND",
  "OR",
  "NOT",
]);

const text = readFileSync(resolve(ROOT, DOC), "utf8");

// Pull every backtick-quoted span, then keep the ones that look like a single
// code anchor (identifier, call, env var, dotted key, or file path).
const spans = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());

const CODE_ANCHOR = /^[A-Za-z_][A-Za-z0-9_.\-/]*(\(\))?$/;

const anchors = [];
const seen = new Set();
for (const raw of spans) {
  const token = raw.replace(/\(\)$/, ""); // isAIEnabled() -> isAIEnabled
  if (token.includes("*")) continue; // globs like ai_*
  if (token.length < 4) continue; // too short to be meaningful
  if (SKIP.has(token)) continue;
  if (!CODE_ANCHOR.test(raw)) continue;
  if (seen.has(token)) continue;
  seen.add(token);
  anchors.push({ raw, token, isPath: token.includes("/") });
}

function tracked(token) {
  // Literal, fixed-string search over tracked files, excluding the doc itself.
  try {
    const out = execFileSync(
      "git",
      ["grep", "-l", "-F", "--", token, ":(exclude)" + DOC],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return []; // git grep exits 1 when there are no matches
  }
}

const missing = [];
const resolved = [];
for (const a of anchors) {
  if (a.isPath && /\.[a-z]+$/i.test(a.token)) {
    // Looks like a file path — verify it exists on disk.
    if (existsSync(resolve(ROOT, a.token))) resolved.push(a);
    else missing.push({ ...a, reason: "file does not exist" });
    continue;
  }
  const hits = tracked(a.token);
  if (hits.length > 0) resolved.push(a);
  else missing.push({ ...a, reason: "no occurrence in tracked source" });
}

if (missing.length > 0) {
  console.error(`❌ MVP_SCOPE.md references symbols that no longer exist in the codebase:`);
  for (const m of missing) console.error(`  • \`${m.raw}\` — ${m.reason}`);
  console.error(
    `\nUpdate MVP_SCOPE.md to match the code (or restore the symbol). ` +
      `This doc is read by auditors; it must not describe gating that does not exist.`,
  );
  process.exit(1);
}

console.log(`✅ MVP_SCOPE.md scope-reference check passed — ${resolved.length} code anchors resolve:`);
for (const a of resolved) console.log(`   • ${a.raw}`);
