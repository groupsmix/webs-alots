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

/**
 * AUDIT P2-13: Context window for ambiguous ID patterns.
 *
 * `\b\d{9}\b` (CNSS) matches ANY 9-digit number — lot numbers, lab accession
 * IDs, large microgram dosages — and `[A-Z]{1,2}\d{5,7}` (CIN) matches lab
 * codes like "HB123456". Blanket redaction silently replaced clinically
 * meaningful numbers with [REDACTED_*], which can change medical meaning.
 *
 * These two patterns are now only redacted when an identity/insurance
 * keyword appears within the preceding window. Unambiguous patterns
 * (phone, email, IBAN, passport) remain blanket-redacted.
 */
const ID_CONTEXT_WINDOW = 48;
const ID_CONTEXT_KEYWORDS =
  /(cnss|cnops|s[ée]curit[ée]\s+sociale|assurance|immatricul|matricule|adh[ée]rent|affili|\bcin\b|c\.i\.n|carte\s+nationale|identit[ée]|رقم|بطاقة|الضمان|التأمين)/i;

/**
 * Redact matches of `pattern` only when identity context appears in the
 * preceding window. Returns the cleaned text and the number of redactions.
 */
function redactWithContext(
  text: string,
  pattern: RegExp,
  replacement: string,
): { text: string; hits: number } {
  let hits = 0;
  const cleaned = text.replace(pattern, (...args) => {
    const match = args[0] as string;
    // Last two replacer args are (offset, fullString) — patterns here use
    // no named capture groups, so this indexing is stable.
    const offset = args[args.length - 2] as number;
    const before = text.slice(Math.max(0, offset - ID_CONTEXT_WINDOW), offset);
    if (ID_CONTEXT_KEYWORDS.test(before)) {
      hits++;
      return replacement;
    }
    return match;
  });
  return { text: cleaned, hits };
}

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

  // AUDIT P2-13: context-guarded — see redactWithContext above.
  const cinResult = redactWithContext(cleaned, MOROCCAN_CIN, "[REDACTED_ID]");
  if (cinResult.hits > 0) {
    cleaned = cinResult.text;
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

  // AUDIT P2-13: context-guarded — see redactWithContext above.
  const cnssResult = redactWithContext(cleaned, CNSS_NUMBER, "[REDACTED_INS]");
  if (cnssResult.hits > 0) {
    cleaned = cnssResult.text;
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
