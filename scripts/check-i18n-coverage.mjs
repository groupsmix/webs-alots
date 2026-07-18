#!/usr/bin/env node
/**
 * CI guard: strict i18n key-coverage.
 *
 * French (fr.json) is the source of truth. The script enforces:
 * 1. Every key used in source `t()` calls exists in fr.json.
 * 2. Every non-empty fr key exists and is non-empty in every target locale.
 * 3. Target locale files have the exact same key set as fr.json.
 * 4. The ary (Darija) locale does not silently fall back to French values.
 *
 * This replaces the old literal-string ratchet with a key-coverage contract.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Read + parse a JSON file, failing with a clear message instead of a stack trace. */
function readJson(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`::error::Required file not found: ${path}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`::error::Invalid JSON in ${path}: ${err?.message ?? err}`);
    process.exit(1);
  }
}

const fr = readJson("src/locales/fr.json");
const en = readJson("src/locales/en.json");
const ar = readJson("src/locales/ar.json");
const baseline = readJson(".i18n-coverage-baseline.json");
const frKeys = Object.keys(fr);
const allLocales = Object.keys(baseline);

if (!allLocales.includes("ary")) {
  console.error("::error::.i18n-coverage-baseline.json must include 'ary'");
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__" || entry === "__mocks__") continue;
      yield* walk(path);
    } else if (extname(path) === ".ts" || extname(path) === ".tsx") {
      yield path;
    }
  }
}

const SOURCE_DIRS = ["src"];
const tKeyPattern = /\bt\(\s*(?:[^,]+,\s*)?["'`]([^"'`]+)["'`]/g;
const usedKeys = new Set();

for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, "utf8");
    if (file.endsWith("src/lib/i18n.ts")) continue;
    let match;
    while ((match = tKeyPattern.exec(content)) !== null) {
      const key = match[1];
      if (key.includes("${")) continue; // skip template literal dynamic keys
      usedKeys.add(key);
    }
  }
}

const missingFromFr = [...usedKeys]
  .filter((key) => !(key in fr))
  .sort((a, b) => a.localeCompare(b));

if (missingFromFr.length > 0) {
  console.error(
    `::error::${missingFromFr.length} i18n keys used in source are missing from fr.json. ` +
      `Add them to fr.json first, then to all other locales.`,
  );
  console.error(missingFromFr.slice(0, 20).join("\n"));
  process.exit(1);
}

let failed = false;

for (const locale of allLocales) {
  const dict = readJson(`src/locales/${locale}.json`);
  const dictKeys = Object.keys(dict);

  // Missing/extra key checks
  const missingInTarget = frKeys.filter((k) => !Object.hasOwn(dict, k));
  const extraInTarget = dictKeys.filter((k) => !Object.hasOwn(fr, k));
  const emptyInTarget = frKeys.filter((k) => {
    const value = dict[k];
    return fr[k] !== "" && fr[k] != null && (value === "" || value == null);
  });

  if (extraInTarget.length > 0) {
    console.error(
      `::error::Locale "${locale}" has keys not in fr.json: ${extraInTarget.slice(0, 10).join(", ")}`,
    );
    failed = true;
  }

  if (missingInTarget.length > 0) {
    console.error(
      `::error::Locale "${locale}" is missing keys: ${missingInTarget.slice(0, 20).join(", ")}`,
    );
    failed = true;
  }

  if (emptyInTarget.length > 0) {
    console.error(
      `::error::Locale "${locale}" has empty values for non-empty fr keys: ${emptyInTarget
        .slice(0, 20)
        .join(", ")}`,
    );
    failed = true;
  }

  // Darija (ary) must not silently be a French copy. If an ary value is
  // identical to the French value and the French value is not also identical
  // to the Arabic/English value (a Latin/brand string that is locale-agnostic),
  // it is a copied French value.
  if (locale === "ary") {
    const frenchCopyKeys = [];
    for (const key of frKeys) {
      const aryValue = dict[key];
      const frValue = fr[key];
      if (aryValue !== frValue) continue;
      if (frValue === en[key] || frValue === ar[key]) continue;
      if (frValue === "" || frValue == null) continue;
      frenchCopyKeys.push(key);
    }
    if (frenchCopyKeys.length > 0) {
      console.error(
        `::error::ary (Darija) has ${frenchCopyKeys.length} values that are a direct copy of fr.json: ${frenchCopyKeys
          .slice(0, 20)
          .join(", ")}`,
      );
      failed = true;
    }
  }

  const floor = baseline[locale];
  if (typeof floor !== "number") {
    console.error(
      `::error::No numeric baseline for locale "${locale}" in .i18n-coverage-baseline.json`,
    );
    failed = true;
    continue;
  }

  const gapCount = missingInTarget.length + emptyInTarget.length;
  if (gapCount > floor) {
    failed = true;
    console.error(
      `::error::i18n coverage regressed for "${locale}": ${gapCount} gaps (baseline ${floor}).`,
    );
  } else if (gapCount < floor) {
    console.log(
      `i18n coverage improved for "${locale}": ${gapCount} gaps (baseline ${floor}). ` +
        `Lower "${locale}" in .i18n-coverage-baseline.json to ${gapCount} to lock in the gain.`,
    );
  } else {
    console.log(`i18n coverage for "${locale}": ${gapCount} gaps (at baseline ${floor}).`);
  }
}

if (failed) {
  console.error("::error::Strict i18n key-coverage check failed.");
  process.exit(1);
}

console.log("Strict i18n key-coverage check passed.");
