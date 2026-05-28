#!/usr/bin/env node
/**
 * [003] Translation completeness ratchet guard.
 *
 * Counts the number of empty-string values in en.json and ar.json
 * (keys that exist but have no translation). Fails CI if the count
 * exceeds the committed baseline in `.translation-empty-baseline`.
 *
 * The baseline must only go DOWN (as translations are backfilled),
 * never up. This prevents new French keys from being added without
 * paired EN/AR translations.
 *
 * Usage:
 *   node scripts/check-translations.mjs
 */

import fs from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.resolve("src/locales");
const BASELINE_PATH = path.resolve(".translation-empty-baseline");

const fr = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "fr.json"), "utf-8"));
const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf-8"));
const ar = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "ar.json"), "utf-8"));

const frKeys = Object.keys(fr);

// Count empty-string values in EN and AR
const emptyEn = frKeys.filter((k) => k in en && en[k] === "");
const emptyAr = frKeys.filter((k) => k in ar && ar[k] === "");

// Count FR keys missing entirely from EN/AR
const missingEn = frKeys.filter((k) => !(k in en));
const missingAr = frKeys.filter((k) => !(k in ar));

const totalGaps = Math.max(emptyEn.length + missingEn.length, emptyAr.length + missingAr.length);

const baseline = parseInt(fs.readFileSync(BASELINE_PATH, "utf-8").trim(), 10);

console.log(
  `Translation gaps: EN ${emptyEn.length} empty + ${missingEn.length} missing = ${emptyEn.length + missingEn.length}`,
);
console.log(
  `Translation gaps: AR ${emptyAr.length} empty + ${missingAr.length} missing = ${emptyAr.length + missingAr.length}`,
);
console.log(`Worst-case total: ${totalGaps} (baseline: ${baseline})`);

if (totalGaps > baseline) {
  console.error(
    `::error::Translation gap count ${totalGaps} exceeds baseline ${baseline} — ` +
      `new FR keys must have non-empty EN and AR translations.`,
  );
  process.exit(1);
}

if (totalGaps < baseline) {
  console.log(
    `Baseline can be lowered from ${baseline} to ${totalGaps}. ` +
      `Update .translation-empty-baseline to ratchet down.`,
  );
}

console.log("Translation ratchet check passed.");
