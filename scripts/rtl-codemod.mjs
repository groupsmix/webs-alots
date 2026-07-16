#!/usr/bin/env node
/**
 * RTL physical-to-logical Tailwind codemod.
 *
 * Replaces physical margin/padding/text utilities in TS/TSX class strings with
 * their logical equivalents:
 *   ml-* -> ms-*
 *   mr-* -> me-*
 *   pl-* -> ps-*
 *   pr-* -> pe-*
 *   text-left  -> text-start
 *   text-right -> text-end
 *
 * The spacing regex requires a hyphen after the prefix so it does not match
 * the `pr` in French words such as "précédent".
 */
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { glob } from "glob";

const SPACING_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_-])((?:[A-Za-z0-9-]+:)*!?-?)(ml|mr|pl|pr)(-[A-Za-z0-9.\[\]()_%/]+)(?![A-Za-z0-9_-])`,
  "g",
);

const TEXT_ALIGN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_-])((?:[A-Za-z0-9-]+:)*!?)(text-left|text-right)(?![A-Za-z0-9_-])`,
  "g",
);

const SPACING_MAP = { ml: "ms", mr: "me", pl: "ps", pr: "pe" };
const TEXT_MAP = { "text-left": "text-start", "text-right": "text-end" };

const files = await glob("src/**/*.{ts,tsx}");
let changed = 0;

for (const file of files) {
  if (extname(file) === ".css") continue;

  const original = await readFile(file, "utf8");
  let updated = original;

  updated = updated.replace(SPACING_RE, (match, prefix, core, tail) => {
    const replacement = SPACING_MAP[core];
    return `${prefix}${replacement}${tail}`;
  });

  updated = updated.replace(TEXT_ALIGN_RE, (match, prefix, core) => {
    return `${prefix}${TEXT_MAP[core]}`;
  });

  if (updated !== original) {
    await writeFile(file, updated, "utf8");
    changed++;
  }
}

console.log(`Updated ${changed} files.`);
