#!/usr/bin/env node
/**
 * translate-ary.mjs — Generate a real Darija (ary) locale from fr.json.
 *
 * Uses the Tkalam Maghreb dialect API by default. If no API key is available
 * the script falls back to copying ar.json (MSA Arabic) so ary.json is at least
 * a real Arabic translation instead of the French copy.
 *
 * Usage:
 *   DARIJA_TRANSLATION_API_KEY=tk_xxx node scripts/translate-ary.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FR_PATH = "src/locales/fr.json";
const AR_PATH = "src/locales/ar.json";
const ARY_PATH = "src/locales/ary.json";

const API_KEY = process.env.DARIJA_TRANSLATION_API_KEY;
const API_URL = process.env.DARIJA_TRANSLATION_API_URL || "https://api.tkalam.com/v1/translate";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function translateBatch(texts, _from = "fr", to = "darija") {
  if (!API_KEY) {
    throw new Error("DARIJA_TRANSLATION_API_KEY is not set");
  }

  // Tkalam translates a single text at a time on the free tier; loop with
  // a small delay to avoid rate limits.
  const results = [];
  for (const text of texts) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, target_dialect: to, style: "informal" }),
    });
    if (!res.ok) {
      throw new Error(`Tkalam API error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    // Accept common response shapes: { translation } or { translatedText }
    const translated = data.translation || data.translatedText || data.text;
    if (typeof translated !== "string") {
      throw new Error(`Unexpected Tkalam response shape: ${JSON.stringify(data)}`);
    }
    results.push(translated);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return results;
}

async function main() {
  const fr = loadJson(FR_PATH);
  const ar = loadJson(AR_PATH);
  const keys = Object.keys(fr);

  if (!API_KEY) {
    console.log("DARIJA_TRANSLATION_API_KEY not set; using ar.json (MSA Arabic) as ary fallback.");
    saveJson(ARY_PATH, ar);
    console.log(`Wrote ${keys.length} keys to ${ARY_PATH} from ar.json.`);
    return;
  }

  console.log(`Translating ${keys.length} keys to Darija via ${API_URL}...`);
  const values = keys.map((k) => fr[k]);
  const translated = await translateBatch(values);

  const ary = {};
  for (let i = 0; i < keys.length; i++) {
    ary[keys[i]] = translated[i];
  }

  saveJson(ARY_PATH, ary);
  console.log(`Wrote ${keys.length} Darija keys to ${ARY_PATH}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
