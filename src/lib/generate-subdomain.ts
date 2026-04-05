/**
 * Generate a URL-safe subdomain from a clinic name.
 *
 * Examples:
 *   "Cabinet Dr Ahmed"       → "dr-ahmed"
 *   "Clinique Dentaire Fès"  → "clinique-dentaire-fes"
 *   "Dr. Fatima El Amrani"   → "dr-fatima-el-amrani"
 *   "Pharmacie Ibn Sina"     → "pharmacie-ibn-sina"
 *
 * The function:
 *   1. Normalises Unicode (removes diacritics)
 *   2. Lowercases
 *   3. Strips common prefixes like "cabinet" when the name is long enough
 *   4. Replaces non-alphanumeric characters with hyphens
 *   5. Collapses consecutive hyphens and trims edges
 *   6. Appends a short random suffix to avoid collisions
 */

/**
 * Normalise a string for use as a subdomain slug.
 * Pure function — no randomness, useful for testing.
 */
export function slugify(input: string): string {
  let slug = input
    // Decompose accented characters (é → e + combining accent) then strip accents
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Lowercase
    .toLowerCase()
    // Replace any non-alphanumeric character with a hyphen
    .replace(/[^a-z0-9]+/g, "-")
    // Collapse consecutive hyphens
    .replace(/-{2,}/g, "-")
    // Trim leading/trailing hyphens
    .replace(/^-|-$/g, "");

  // Strip common prefixes when the result is long enough to remain meaningful
  const prefixes = ["cabinet-", "clinique-", "pharmacie-", "centre-"];
  for (const prefix of prefixes) {
    if (slug.startsWith(prefix) && slug.length > prefix.length + 2) {
      slug = slug.slice(prefix.length);
      break;
    }
  }

  // Ensure minimum length
  if (slug.length === 0) {
    slug = "clinic";
  }

  // Cap length at 40 characters (leaving room for a random suffix)
  if (slug.length > 40) {
    slug = slug.slice(0, 40).replace(/-$/, "");
  }

  return slug;
}

/**
 * Generate a candidate subdomain from a clinic name.
 * Appends a 6-digit random suffix to reduce collision probability.
 * MED-08: Increased from 4-digit (9,000 values) to 6-digit (900,000 values)
 * to reduce birthday-paradox collisions for popular clinic name prefixes.
 */
export function generateSubdomain(clinicName: string): string {
  const base = slugify(clinicName);
  // 6-digit random suffix: 100,000–999,999 (900,000 possible values)
  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `${base}-${suffix}`;
}
