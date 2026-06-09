/**
 * Audit F-2 (item 2.3): conservative quality gate for free-text names that
 * become public tenant identity (clinic_name → subdomain slug + sitemap entry).
 *
 * The self-service registration endpoint generated junk tenants such as
 * `fffffff`, `ahhhhhe`, `jgjjrjrj`, `vdsvv`, and `rtqz` because the only check
 * on `clinic_name` was `min(2).max(200)`. These slugs polluted the public
 * sitemap (SEO duplicate-content) and made the brand look unmoderated.
 *
 * DESIGN — bias hard toward NOT blocking real clinics. A French / Arabic-
 * romanized / Darija clinic name almost always contains vowels and does not
 * mash the same key. We therefore reject ONLY on signals that are essentially
 * never present in a real name:
 *
 *   1. A single letter repeated ≥ 4 times in a row  → "fffffff", "ahhhhhe".
 *   2. No pronounceable token at all — i.e. not one alphabetic run of length
 *      ≥ 2 contains a vowel (a, e, i, o, u, y)        → "rtqz", "vdsvv",
 *      "jgjjrjrj". A name like "Cabinet rtqz" still passes because "cabinet"
 *      is a vowel-bearing token; the goal is to catch all-gibberish input,
 *      not to police every token.
 *   3. Fewer than 2 alphabetic characters total       → "12", "—".
 *
 * Deliberately NOT caught: short real-ish words with vowels (e.g. "azar",
 * "saara", "staf"). Those are indistinguishable from a legitimate short name
 * by spelling alone and must be handled by human review, never by an automated
 * spelling judge that could reject a real clinic at signup.
 *
 * Pure + side-effect free so it is trivially unit-testable and safe to call
 * from a Zod refinement.
 */

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/** Strip diacritics and lowercase so "Fès" and "FES" normalize identically. */
function foldLetters(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasVowel(token: string): boolean {
  for (const ch of token) {
    if (VOWELS.has(ch)) return true;
  }
  return false;
}

/**
 * Returns true when `value` looks like keyboard-mash / placeholder gibberish
 * rather than a real name. Conservative by design (see module docstring):
 * a false negative (junk slips through) is preferable to a false positive
 * (a real clinic is blocked at registration).
 */
export function looksLikeGibberish(value: string): boolean {
  const folded = foldLetters(value);

  // Rule 3: must contain at least 2 letters of actual content.
  const letters = folded.replace(/[^a-z]/g, "");
  if (letters.length < 2) return true;

  // Rule 1: same letter repeated 4+ times in a row (ignore spacing).
  if (/([a-z])\1{3,}/.test(folded.replace(/[^a-z]/g, ""))) return true;

  // Rule 2: no alphabetic token (length ≥ 2) contains a vowel → unpronounceable.
  const tokens = folded.split(/[^a-z]+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return true; // only 1-letter fragments
  if (!tokens.some(hasVowel)) return true;

  return false;
}

/** User-facing rejection message (French — matches the rest of the schema). */
export const GIBBERISH_NAME_MESSAGE =
  "Veuillez saisir un nom d'établissement valide.";
