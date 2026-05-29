/**
 * A115-01 / A101-03: Shared AI output safety validator.
 *
 * Hard-rejects content that contains role-elevation language or unredacted
 * PII patterns. Returns the sanitised string, or `null` if the
 * response is unsafe and must be discarded.
 *
 * Apply to every AI route (`/api/chat`, `/api/ai/*`, `/api/v1/ai/*`).
 *
 * A108-2: Extended to redact email addresses and Moroccan insurance
 * (CNSS/CNOPS) numbers in addition to phone and CIN.
 *
 * A108-3: Emits structured `ai.guardrail.triggered` log events when
 * the output validator rejects or redacts content, enabling abuse metrics.
 */

import { logger } from "@/lib/logger";

// W8-A26-01: Expanded role-elevation pattern with i18n tokens (French, Arabic,
// Darija) to catch multilingual prompt-injection responses.
const ROLE_ELEVATION =
  /\b(i am now|role changed to|switched to admin|access granted|patient list|dump all|SELECT \*|je suis maintenant|rôle changé|accès accordé|أنا الآن مدير|وصول ممنوح|تم تغيير الدور|lista de pacientes|supprimer tous)\b/i;

const MOROCCAN_PHONE = /(?:\+212|0)([ .\-]?\d){9}/g;
const MOROCCAN_CIN = /\b[A-Z]{1,2}\d{5,7}\b/g;

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g;
const MOROCCAN_PASSPORT = /\b[A-Z]{2}\d{7}\b/g;
const CNSS_NUMBER = /\b\d{9}\b/g;

export function validateAIOutput(text: string): string | null {
  // W8-A26-01: NFKC-normalize to collapse Unicode tricks (e.g. fullwidth
  // Latin letters, combining characters) that could bypass the regex.
  const normalized = text.normalize("NFKC");

  if (ROLE_ELEVATION.test(normalized)) {
    logger.warn("ai.guardrail.triggered", {
      context: "ai-output-validator",
      guardrail: "role_elevation_reject",
      action: "blocked",
    });
    return null;
  }

  let cleaned = normalized;
  const redactedTypes: string[] = [];

  const hadPhone = MOROCCAN_PHONE.test(cleaned);
  if (hadPhone) {
    MOROCCAN_PHONE.lastIndex = 0;
    cleaned = cleaned.replace(MOROCCAN_PHONE, "[REDACTED_PHONE]");
    redactedTypes.push("phone");
  }

  const hadCin = MOROCCAN_CIN.test(cleaned);
  if (hadCin) {
    MOROCCAN_CIN.lastIndex = 0;
    cleaned = cleaned.replace(MOROCCAN_CIN, "[REDACTED_ID]");
    redactedTypes.push("cin");
  }

  const hadEmail = EMAIL_PATTERN.test(cleaned);
  if (hadEmail) {
    EMAIL_PATTERN.lastIndex = 0;
    cleaned = cleaned.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
    redactedTypes.push("email");
  }

  const hadIban = IBAN_PATTERN.test(cleaned);
  if (hadIban) {
    IBAN_PATTERN.lastIndex = 0;
    cleaned = cleaned.replace(IBAN_PATTERN, "[REDACTED_IBAN]");
    redactedTypes.push("iban");
  }

  const hadPassport = MOROCCAN_PASSPORT.test(cleaned);
  if (hadPassport) {
    MOROCCAN_PASSPORT.lastIndex = 0;
    cleaned = cleaned.replace(MOROCCAN_PASSPORT, "[REDACTED_PASSPORT]");
    redactedTypes.push("passport");
  }

  const hadCnss = CNSS_NUMBER.test(cleaned);
  if (hadCnss) {
    CNSS_NUMBER.lastIndex = 0;
    cleaned = cleaned.replace(CNSS_NUMBER, "[REDACTED_INS]");
    redactedTypes.push("ins_number");
  }

  if (redactedTypes.length > 0) {
    logger.warn("ai.guardrail.triggered", {
      context: "ai-output-validator",
      guardrail: "pii_redaction",
      action: "redacted",
      redactedTypes,
    });
  }

  return cleaned;
}
