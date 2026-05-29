import { z } from "zod";

/** ISO date string YYYY-MM-DD */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Time string HH:MM */
export const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM");

/**
 * A14-04 / A14-05 / S0-4-03: canonical text normalization.
 *
 * - Strips C0 control characters (U+0000–U+0008, U+000B, U+000C,
 *   U+000E–U+001F) and DEL (U+007F). Tabs (\t), newlines (\n), and
 *   carriage returns (\r) are preserved for multiline fields.
 * - Normalizes to Unicode NFC. Without this, attackers can register two
 *   visually identical names (e.g. composed vs. decomposed accents) that
 *   compare unequal byte-for-byte, defeating uniqueness checks and
 *   user-recognition workflows.
 *
 * Use `safeText` for free-form fields and `safeName` for short identifiers.
 */
export function normalizeText(value: string): string {
  return (
    value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // IV-01/IV-05: Strip bidi override characters to prevent text spoofing.
      .replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, "")
      // A14-05: NFKC normalization (compatibility decomposition + canonical
      // composition) — prevents visually identical but byte-different strings
      .normalize("NFKC")
  );
}

/**
 * S0-04-05: Phone number validation.
 * Accepts international formats: +212 6XX XXX XXX, (0)5XX-XXX-XXX, etc.
 * Rejects strings that don't look like phone numbers at all.
 */
export const phoneNumber = z
  .string()
  .min(8, "Phone number too short")
  .max(30, "Phone number too long")
  .regex(/^\+?[0-9 ()\-]{8,30}$/, "Invalid phone number format");

/**
 * Validate Moroccan phone numbers.
 * Accepted formats: +212 6XXXXXXXX, +212 7XXXXXXXX, 06XXXXXXXX, 07XXXXXXXX
 * (with or without spaces/dashes).
 */
export function isValidMoroccanPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-().]/g, "");
  return /^(?:\+212|0)[67]\d{8}$/.test(digits);
}

/** Free-form user-supplied text (notes, content, descriptions). */
export const safeText = z.string().transform(normalizeText);

/** Short identifying text (names, titles). Trims surrounding whitespace. */
export const safeName = z.string().transform((v) => normalizeText(v).trim());
