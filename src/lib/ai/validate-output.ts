/**
 * A115-01 / A101-03: Shared AI output safety validator.
 *
 * Hard-rejects content that contains role-elevation language or unredacted
 * Moroccan PII patterns. Returns the sanitised string, or `null` if the
 * response is unsafe and must be discarded.
 *
 * Apply to every AI route (`/api/chat`, `/api/ai/*`, `/api/v1/ai/*`).
 */

// W8-A26-01: Expanded role-elevation pattern with i18n tokens (French, Arabic,
// Darija) to catch multilingual prompt-injection responses.
const ROLE_ELEVATION =
  /\b(i am now|role changed to|switched to admin|access granted|patient list|dump all|SELECT \*|je suis maintenant|rôle changé|accès accordé|أنا الآن مدير|وصول ممنوح|تم تغيير الدور|lista de pacientes|supprimer tous)\b/i;

const MOROCCAN_PHONE = /(?:\+212|0)([ .\-]?\d){9}/g;
const MOROCCAN_CIN = /\b[A-Z]{1,2}\d{5,7}\b/g;

// A108-01: Additional PII patterns beyond MA phone/CIN.
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g;
const MOROCCAN_PASSPORT = /\b[A-Z]{2}\d{7}\b/g;

export function validateAIOutput(text: string): string | null {
  // W8-A26-01: NFKC-normalize to collapse Unicode tricks (e.g. fullwidth
  // Latin letters, combining characters) that could bypass the regex.
  const normalized = text.normalize("NFKC");
  if (ROLE_ELEVATION.test(normalized)) return null;
  let cleaned = normalized.replace(MOROCCAN_PHONE, "[REDACTED_PHONE]");
  cleaned = cleaned.replace(MOROCCAN_CIN, "[REDACTED_ID]");
  cleaned = cleaned.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
  cleaned = cleaned.replace(IBAN_PATTERN, "[REDACTED_IBAN]");
  cleaned = cleaned.replace(MOROCCAN_PASSPORT, "[REDACTED_PASSPORT]");
  return cleaned;
}
