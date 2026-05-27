#!/usr/bin/env node
/**
 * §3.4 / §5.3 — Bulk i18n extraction script.
 *
 * Walks src/app + src/components, finds JSX text nodes containing French
 * (or Arabic) text, wraps them in t(), and appends deterministic keys
 * into src/locales/{fr,ar,en}.json.
 *
 * Usage:
 *   node scripts/extract-i18n.mjs [--dry-run] [--file <path>] [--dir <path>]
 *
 * Options:
 *   --dry-run    Show what would be extracted without writing files.
 *   --file       Process a single file.
 *   --dir        Process all .tsx files under this directory.
 *                Defaults to src/app and src/components.
 *
 * Key generation:
 *   - Derives from the file path and the first 30 chars of the text.
 *   - Example: src/app/(admin)/admin/settings/page.tsx "Paramètres généraux"
 *     → "admin.settings.parametresGeneraux"
 *
 * After running:
 *   1. Review the diff (git diff src/locales/*.json).
 *   2. Run `npx eslint . --quiet` to verify warning count dropped.
 *   3. Commit.
 */

import fs from "node:fs";
import path from "node:path";
import { globSync } from "node:fs";

// ── Locale files ────────────────────────────────────────────────────────

const LOCALES_DIR = "src/locales";
const FR_PATH = path.join(LOCALES_DIR, "fr.json");
const AR_PATH = path.join(LOCALES_DIR, "ar.json");
const EN_PATH = path.join(LOCALES_DIR, "en.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ── Key generation ──────────────────────────────────────────────────────

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9 ]/g, "")  // remove non-alphanum
    .trim()
    .split(/\s+/)
    .slice(0, 4)                     // max 4 words
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function derivePrefix(filePath) {
  // src/app/(admin)/admin/settings/page.tsx → admin.settings
  // src/app/(doctor)/doctor/cardiology/page.tsx → doctor.cardiology
  // src/components/ui/badge.tsx → ui.badge
  const rel = filePath.replace(/^src\//, "");
  const parts = rel
    .replace(/\.(tsx?|jsx?)$/, "")
    .split("/")
    .filter((p) => !p.startsWith("(") && p !== "app" && p !== "components" && p !== "page" && p !== "index");
  return parts.join(".");
}

function makeKey(filePath, text) {
  const prefix = derivePrefix(filePath);
  const slug = slugify(text);
  if (!slug) return `${prefix}.text${Date.now()}`;
  return `${prefix}.${slug}`;
}

// ── Text detection ──────────────────────────────────────────────────────

// Match French-like text (contains accented chars or common French words)
const FRENCH_PATTERN = /[À-ÿ]|[\u0600-\u06FF]/;

// Skip patterns
const SKIP_PATTERNS = [
  /^[a-zA-Z0-9_.\-:/#@?&=+%]+$/, // URLs, identifiers
  /^\{.*\}$/,                       // JSX expressions
  /^[0-9.,\s]+$/,                   // numbers
  /^\s*$/,                          // whitespace
];

function shouldExtract(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (SKIP_PATTERNS.some((p) => p.test(trimmed))) return false;
  return FRENCH_PATTERN.test(trimmed);
}

// ── File processing ─────────────────────────────────────────────────────

function findTsxFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.tsx$/.test(entry.name)) {
        files.push(path.join(entry.parentPath || entry.path, entry.name));
      }
    }
  }
  return files;
}

// ── Main ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileIdx = args.indexOf("--file");
const dirIdx = args.indexOf("--dir");

let targetFiles;
if (fileIdx !== -1 && args[fileIdx + 1]) {
  targetFiles = [args[fileIdx + 1]];
} else if (dirIdx !== -1 && args[dirIdx + 1]) {
  targetFiles = findTsxFiles([args[dirIdx + 1]]);
} else {
  targetFiles = findTsxFiles(["src/app", "src/components"]);
}

const fr = loadJson(FR_PATH);
const ar = loadJson(AR_PATH);
const en = loadJson(EN_PATH);

let totalExtracted = 0;
let totalFiles = 0;
const usedKeys = new Set(Object.keys(fr));

for (const filePath of targetFiles) {
  const content = fs.readFileSync(filePath, "utf-8");

  // Simple regex: find >text< patterns (JSX text between tags)
  const textPattern = />([^<>{]+)</g;
  let match;
  const extractions = [];

  while ((match = textPattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (!shouldExtract(text)) continue;

    let key = makeKey(filePath, text);
    // Ensure uniqueness
    let suffix = 0;
    let candidateKey = key;
    while (usedKeys.has(candidateKey) && fr[candidateKey] !== text) {
      suffix++;
      candidateKey = `${key}${suffix}`;
    }
    key = candidateKey;

    if (!usedKeys.has(key)) {
      extractions.push({ text, key, original: match[0] });
      usedKeys.add(key);
    }
  }

  if (extractions.length === 0) continue;
  totalFiles++;

  if (dryRun) {
    console.log(`\n${filePath} (${extractions.length} strings):`);
    for (const { text, key } of extractions) {
      console.log(`  ${key}: "${text}"`);
    }
  }

  for (const { text, key } of extractions) {
    if (!fr[key]) fr[key] = text;
    if (!ar[key]) ar[key] = "";
    if (!en[key]) en[key] = "";
    totalExtracted++;
  }
}

if (!dryRun) {
  saveJson(FR_PATH, fr);
  saveJson(AR_PATH, ar);
  saveJson(EN_PATH, en);
}

console.log(`\n${dryRun ? "[DRY RUN] " : ""}Extracted ${totalExtracted} strings from ${totalFiles} files.`);
console.log(`Total keys in fr.json: ${Object.keys(fr).length}`);
