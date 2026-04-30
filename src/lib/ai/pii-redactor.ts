/**
 * A108: PII redactor for AI model inputs.
 *
 * Strips or replaces personally identifiable information before sending
 * text to external AI providers (OpenAI, Cloudflare Workers AI). This is
 * defense-in-depth against PHI leaking to third-party model providers.
 *
 * What is redacted:
 *   - Moroccan phone numbers (+212…, 06…, 07…)
 *   - Email addresses
 *   - Moroccan national ID (CNIE) patterns
 *   - Credit card numbers (basic Luhn-shaped sequences)
 *   - Dates of birth in common formats
 *
 * What is NOT redacted (intentionally):
 *   - Patient names (needed for prescription context; the model must
 *     address the patient). The name comes from the clinic's own DB,
 *     not from untrusted input.
 *   - Medical data (diagnoses, allergies, medications) — this is the
 *     core purpose of the AI call and cannot be stripped.
 *
 * To fully eliminate PHI exposure, switch to a self-hosted model or
 * use an OpenAI BAA (Business Associate Agreement) endpoint.
 */

/** Moroccan phone: +212 6xx xxx xxx, 06xx-xx-xx-xx, etc. */
const PHONE_RE =
  /(?:\+?212[\s.-]?|0)[567]\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/g;

/** Email addresses */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Moroccan CNIE: letter + digits, e.g. AB123456, BK 654321 */
const CNIE_RE = /\b[A-Z]{1,3}\s?\d{5,7}\b/g;

/** Credit card-like sequences: 13-19 digits with optional separators */
const CARD_RE = /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{1,7}\b/g;

/**
 * Common date-of-birth patterns that could identify a person.
 * Matches DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD (ISO).
 * We only redact full dates with year — partial dates (month/day only)
 * are left intact as they have low re-identification risk.
 */
const DOB_RE =
  /\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})\b/g;

const REPLACEMENT = "[REDACTED]";

/**
 * Redact PII from text before it is sent to an external AI provider.
 *
 * Returns the redacted string and the count of redactions applied.
 * The count can be logged for audit purposes without exposing the
 * original values.
 */
export function redactPII(text: string): { redacted: string; count: number } {
  let count = 0;

  const redacted = text
    .replace(PHONE_RE, () => { count++; return REPLACEMENT; })
    .replace(EMAIL_RE, () => { count++; return REPLACEMENT; })
    .replace(CNIE_RE, () => { count++; return REPLACEMENT; })
    .replace(CARD_RE, () => { count++; return REPLACEMENT; })
    .replace(DOB_RE, () => { count++; return REPLACEMENT; });

  return { redacted, count };
}

/**
 * Convenience wrapper: redact PII and return only the string.
 * Use `redactPII()` if you also need the redaction count for logging.
 */
export function redactPIIString(text: string): string {
  return redactPII(text).redacted;
}
