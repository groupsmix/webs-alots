/**
 * CI guard: i18n translation-coverage ratchet.
 *
 * French (fr.json) is the source of truth. For each target locale this
 * script counts keys that are present-and-non-empty in fr but empty or
 * missing in the target locale — i.e. keys that silently fall back to
 * French at runtime (see src/lib/i18n.ts).
 *
 * The current counts are stored in .i18n-coverage-baseline.json and act as
 * a monotonic ratchet: a PR may lower a count (by translating keys) but
 * never raise it (e.g. by adding a new fr key without paired en/ar values).
 * This stops the silent-fallback gap from growing while the existing
 * backlog is translated by humans.
 *
 * Lower a baseline number whenever you translate keys to lock in the gain.
 */
import { readFileSync } from "node:fs";

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
const baseline = readJson(".i18n-coverage-baseline.json");

const TARGET_LOCALES = Object.keys(baseline);

/** Keys non-empty in fr but empty/missing in the target locale. */
function untranslatedKeys(locale) {
  const dict = readJson(`src/locales/${locale}.json`);
  const missing = [];
  for (const [key, value] of Object.entries(fr)) {
    if (value === "" || value == null) continue; // fr itself empty — ignore
    const target = dict[key];
    if (target === undefined || target === null || target === "") {
      missing.push(key);
    }
  }
  return missing;
}

let failed = false;
for (const locale of TARGET_LOCALES) {
  const missing = untranslatedKeys(locale);
  const count = missing.length;
  const floor = baseline[locale];

  if (typeof floor !== "number") {
    console.error(
      `::error::No numeric baseline for locale "${locale}" in .i18n-coverage-baseline.json`,
    );
    failed = true;
    continue;
  }

  if (count > floor) {
    failed = true;
    console.error(
      `::error::i18n coverage regressed for "${locale}": ${count} untranslated keys (baseline ${floor}). ` +
        `Add non-empty "${locale}" values for new fr keys, or do not introduce them.`,
    );
    console.error(`First untranslated "${locale}" keys:\n${missing.slice(0, 20).join("\n")}`);
  } else if (count < floor) {
    console.log(
      `i18n coverage improved for "${locale}": ${count} untranslated (baseline ${floor}). ` +
        `Lower "${locale}" in .i18n-coverage-baseline.json to ${count} to lock in the gain.`,
    );
  } else {
    console.log(`i18n coverage for "${locale}": ${count} untranslated (at baseline ${floor}).`);
  }
}

if (failed) process.exit(1);
console.log("i18n coverage ratchet OK.");
