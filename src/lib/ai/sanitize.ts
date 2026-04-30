/**
 * Sanitize user-supplied text before interpolation into LLM prompts.
 *
 * Defence-in-depth only -- not a security boundary (see chat/route.ts:30-41).
 */
export function sanitizeUntrustedText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
    .replace(/^\s*(s\s*y\s*s\s*t\s*e\s*m|a\s*s\s*s\s*i\s*s\s*t\s*a\s*n\s*t)\s*:/gi, "")
    .replace(/```(system|instructions?)[\s\S]*?```/gi, "")
    .replace(/<\|im_(start|end)\|>\s*(system|assistant)?/gi, "")
    .replace(/<\/?(system|assistant|instruction)[^>]*>/gi, "")
    .replace(/ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi, "[filtered]")
    // A101-2: Strip UNTRUSTED delimiter markers so an attacker cannot close
    // the <<UNTRUSTED_PATIENT_INPUT_BEGIN>> / <<UNTRUSTED_PATIENT_INPUT_END>>
    // boundary early and escape into the trusted portion of the prompt.
    .replace(/<<\s*\/?UNTRUSTED[^>]*>>/gi, "[filtered]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Sanitize data retrieved from the database (FAQ answers, service names,
 * doctor names, etc.) before interpolating into LLM system prompts.
 *
 * A101-1: A malicious clinic_admin (or SQL-injection vector) could plant
 * a stored prompt-injection payload in chatbot_faqs.answer, services.name,
 * or users.name. This function strips the same patterns as
 * {@link sanitizeUntrustedText} so retrieved DB strings cannot hijack the
 * system prompt.
 */
export function sanitizeRetrievedText(s: string | null | undefined): string {
  return sanitizeUntrustedText(s);
}
