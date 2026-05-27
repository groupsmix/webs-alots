import { z } from "zod";

/** ISO date string YYYY-MM-DD */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Time string HH:MM */
export const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM");

/**
 * A14-04 / A14-05: canonical text normalization.
 *
 * - Strips ASCII NUL (`\u0000`) bytes, which Postgres TEXT accepts but which
 *   confuse downstream consumers (logs, JSON, CLI tooling) and can be used
 *   to truncate values in C-string–based code paths.
 * - Normalizes to Unicode NFC. Without this, attackers can register two
 *   visually identical names (e.g. composed vs. decomposed accents) that
 *   compare unequal byte-for-byte, defeating uniqueness checks and
 *   user-recognition workflows.
 *
 * Use `safeText` for free-form fields and `safeName` for short identifiers.
 */
export function normalizeText(value: string): string {
  return value.replace(/\u0000/g, "").normalize("NFC");
}

/** Free-form user-supplied text (notes, content, descriptions). */
export const safeText = z.string().transform(normalizeText);

/** Short identifying text (names, titles). Trims surrounding whitespace. */
export const safeName = z.string().transform((v) => normalizeText(v).trim());
