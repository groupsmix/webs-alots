/**
 * Regression lock-in for Audit F-2 (item 2.3): the clinic-name quality gate
 * that stops keyboard-mash registrations from polluting the public sitemap.
 *
 * The acceptance cases are the load-bearing half: a future tightening of the
 * heuristic must never start rejecting a legitimate French / Arabic-romanized
 * clinic name.
 */
import { describe, it, expect } from "vitest";
import { looksLikeGibberish } from "../validations/name-quality";

describe("looksLikeGibberish — rejects junk (Audit F-2 observed slugs)", () => {
  it.each([
    "fffffff", // single repeated letter
    "ahhhhhe", // 5× h run
    "jgjjrjrj", // no vowel
    "vdsvv", // no vowel
    "rtqz", // no vowel
    "aaaa", // repeated vowel run
    "x", // < 2 letters
    "12", // no letters
    "--", // no letters
    "   ", // whitespace only
  ])("rejects %j", (value) => {
    expect(looksLikeGibberish(value)).toBe(true);
  });
});

describe("looksLikeGibberish — accepts real names (must never block signup)", () => {
  it.each([
    "Cabinet Dr Ahmed",
    "Clinique Dentaire Fès",
    "Dr. Fatima El Amrani",
    "Pharmacie Ibn Sina",
    "Centre Médical Atlas",
    "Polyclinique Al Madina",
    "Cabinet Dentaire du Maarif",
    "Hôpital Cheikh Khalifa",
    "Laboratoire Biolab",
    "Clinique IVF Casablanca", // acronym token, still pronounceable name
    "Cabinet rtqz", // junk token but a real word present → not all-gibberish
    "Saâda Santé", // diacritics fold to vowels
  ])("accepts %j", (value) => {
    expect(looksLikeGibberish(value)).toBe(false);
  });
});
