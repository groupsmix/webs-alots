/**
 * A115-01 / A101-03: Shared AI output safety validator.
 *
 * Hard-rejects content that contains role-elevation language or unredacted
 * Moroccan PII patterns. Returns the sanitised string, or `null` if the
 * response is unsafe and must be discarded.
 *
 * Apply to every AI route (`/api/chat`, `/api/ai/*`, `/api/v1/ai/*`).
 */

const ROLE_ELEVATION =
  /\b(i am now|role changed to|switched to admin|access granted|patient list|dump all|SELECT \*)\b/i;

const MOROCCAN_PHONE = /(?:\+212|0)([ .\-]?\d){9}/g;
const MOROCCAN_CIN = /\b[A-Z]{1,2}\d{5,7}\b/g;

export function validateAIOutput(text: string): string | null {
  if (ROLE_ELEVATION.test(text)) return null;
  const cleaned = text.replace(MOROCCAN_PHONE, "[REDACTED_PHONE]");
  return cleaned.replace(MOROCCAN_CIN, "[REDACTED_ID]");
}
