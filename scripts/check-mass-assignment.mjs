#!/usr/bin/env node

/**
 * CI guard: prevent mass-assignment of request bodies into Supabase mutations.
 *
 * Flags:
 * - .insert(body) / .update(body) / .upsert(body) (and req.body, requestBody, ...)
 * - top-level object/array spread inside .insert/.update/.upsert:
 *   .insert({ ...body }), .update([{ ...body }]), etc.
 *
 * Safe helper files, or files where a constructed payload is intentionally
 * spread after explicit validation, can be added to the ALLOWLIST with a
 * justification comment.
 *
 * Source: P0-3 from docs/deep-research-action-plan.md
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ALLOWLIST = new Map([
  // Onboarding state builds `payload` field-by-field above the upsert; the
  // spread is a convenience to merge a typed, constructed object with timestamps.
  ["src/lib/onboarding/state.ts", "payload is constructed field-by-field, not from request body"],
]);

const SEARCH_DIRS = ["src/app/api", "src/lib/data"];

// Raw request-body identifiers that must not be passed directly to a mutation.
const RAW_BODY_IDS = ["body", "req.body", "requestBody", "rawBody", "formData", "input"];

const rawBodyRe = new RegExp(
  `\\.(?:insert|update|upsert)\\s*\\(\\s*(?:${RAW_BODY_IDS.map((id) => id.replace(/\./g, "\\.")).join("|")})\\b`,
  "g",
);

// Top-level spread of a variable inside an object literal passed to .insert/.update/.upsert.
// This catches .insert({ ...body }) and .insert([{ ...body }]) but does NOT catch
// conditional inline spreads like .update({ ...(cond ? { notes } : {}) })
// because those start with "...(" rather than "...<identifier>".
const spreadRe = /\.(?:insert|update|upsert)\s*\(\s*(?:\[\s*)?\{[^{}]*?\.\.\.\s*[a-zA-Z_]\w*\b/gs;

function getLine(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (path.endsWith(".ts")) {
      yield path;
    }
  }
}

const files = SEARCH_DIRS.filter((d) => {
  try {
    readdirSync(d);
    return true;
  } catch {
    return false;
  }
}).flatMap((d) => [...walk(d)]);

let total = 0;

for (const file of files) {
  const allowReason = ALLOWLIST.get(file);
  const content = readFileSync(file, "utf-8");

  for (const re of [rawBodyRe, spreadRe]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const line = getLine(content, match.index);
      const snippet = match[0].replace(/\s+/g, " ").replace(/\n/g, " ").slice(0, 120);
      if (allowReason) {
        console.log(
          `::warning file=${file},line=${line}::Suppressed mass-assignment guard hit in allowlist (${allowReason}): ${snippet}`,
        );
      } else {
        console.error(`::error file=${file},line=${line}::Possible mass-assignment: ${snippet}`);
        total++;
      }
    }
  }
}

if (total > 0) {
  console.error(`\n❌ ${total} possible mass-assignment pattern(s) found.`);
  console.error(
    "Never pass a raw request body to .insert()/.update()/.upsert() or spread it at the top level of a mutation object.\n" +
      "Pick specific fields: .insert({ name: body.name, phone: body.phone }).\n" +
      "If the variable is a constructed, validated payload, add the file to ALLOWLIST in scripts/check-mass-assignment.mjs with a comment.",
  );
  process.exit(1);
} else {
  console.log("✅ No raw request-body mass-assignment patterns found in Supabase mutations.");
}
