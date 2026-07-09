#!/usr/bin/env node

/**
 * CI guard: prevent runtime references to tables dropped by migration 00187.
 *
 * The dropped-table list is parsed directly from
 * `supabase/migrations/00187_drop_clinical_emr_surface.sql` so the guard
 * cannot drift from the migration itself.
 *
 * This scans server/runtime source for direct database access patterns such as:
 *   - supabase.from("table")
 *   - Database["public"]["Tables"]["table"] references inside runtime code
 *
 * Feature-key strings, docs, and tests are intentionally ignored; this is about
 * preventing executable code from targeting tables that no longer exist.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MIGRATION_FILE = join(ROOT, "supabase", "migrations", "00187_drop_clinical_emr_surface.sql");
const SCAN_ROOTS = [
  join(ROOT, "src", "app"),
  join(ROOT, "src", "lib", "data"),
  join(ROOT, "src", "modules"),
  join(ROOT, "workers"),
];
const IGNORED_SEGMENTS = new Set(["__tests__", "node_modules"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const DROP_TABLE_RE = /^\s*DROP TABLE IF EXISTS\s+([a-z_]+)\s+CASCADE;/gim;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function collectSourceFiles(dir) {
  if (!existsSync(dir)) return [];

  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_SEGMENTS.has(entry.name)) continue;
      results.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    results.push(fullPath);
  }

  return results;
}

if (!existsSync(MIGRATION_FILE) || !statSync(MIGRATION_FILE).isFile()) {
  console.error(`❌ Migration file not found: ${relative(ROOT, MIGRATION_FILE)}`);
  process.exit(1);
}

const migrationSql = readFileSync(MIGRATION_FILE, "utf8");
const droppedTables = [
  ...new Set([...migrationSql.matchAll(DROP_TABLE_RE)].map((match) => match[1])),
].sort();

if (droppedTables.length === 0) {
  console.error(
    `❌ No dropped tables could be parsed from ${relative(ROOT, MIGRATION_FILE)}. ` +
      "Update scripts/check-dropped-clinical-table-refs.mjs if the migration format changed.",
  );
  process.exit(1);
}

const tableAlternation = droppedTables.map(escapeRegex).join("|");
const PATTERNS = [
  {
    kind: 'Supabase .from("table")',
    regex: new RegExp(`\\.from\\(\\s*["'](${tableAlternation})["']\\s*\\)`, "g"),
  },
  {
    kind: 'Runtime Database["public"]["Tables"]["table"] type reference',
    regex: new RegExp(
      `\\["public"\\]\\["Tables"\\]\\["(${tableAlternation})"\\]|\\['public'\\]\\['Tables'\\]\\['(${tableAlternation})'\\]`,
      "g",
    ),
  },
];

const files = SCAN_ROOTS.flatMap(collectSourceFiles);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");

  for (const { kind, regex } of PATTERNS) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      const table = match[1] ?? match[2] ?? "<unknown>";
      const index = match.index ?? 0;
      violations.push({
        file: relative(ROOT, file).replace(/\\/g, "/"),
        line: getLineNumber(content, index),
        table,
        kind,
        snippet: match[0],
      });
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `::error file=${violation.file},line=${violation.line}::Dropped table reference to ` +
        `"${violation.table}" via ${violation.kind}: ${violation.snippet}`,
    );
  }

  console.error(`\n❌ Found ${violations.length} dropped-table runtime reference(s).`);
  console.error(
    "Migration 00187 removed these tables: " +
      droppedTables.join(", ") +
      "\nReplace the broken path, stub the surface, or remove the dead reference before merging.",
  );
  process.exit(1);
}

console.log(
  `✅ No runtime references found to the ${droppedTables.length} tables dropped by migration 00187.`,
);
