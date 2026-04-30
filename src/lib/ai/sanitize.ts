/**
 * Sanitize untrusted text before injection into AI prompts.
 *
 * F-AI-06: Strips the UNTRUSTED delimiter markers that the prompt template
 * uses to fence user content. If an attacker injects these markers into
 * stored data (e.g. chatbot_faqs.answer, services.name, users.name),
 * they could escape the user-content fence and inject system instructions.
 *
 * F-AI-02: Also strips common prompt injection patterns.
 *
 * DEFENCE-IN-DEPTH ONLY — this is not a security boundary. Primary
 * protection comes from labelling user content as "user" turns and
 * system prompt instruction-following directives.
 */
export function sanitizeUntrustedText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    // Strip zero-width / invisible characters
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
    // F-AI-06: Strip UNTRUSTED delimiter markers
    .replace(/---\s*UNTRUSTED\s*---/gi, "")
    .replace(/---\s*END\s*UNTRUSTED\s*---/gi, "")
    .replace(/\[UNTRUSTED\]/gi, "")
    .replace(/\[\/UNTRUSTED\]/gi, "")
    // Strip system/assistant role injection attempts
    .replace(/^\s*(s\s*y\s*s\s*t\s*e\s*m|a\s*s\s*s\s*i\s*s\s*t\s*a\s*n\s*t)\s*:/gi, "")
    .replace(/```(system|instructions?)[\s\S]*?```/gi, "")
    .replace(/<\|im_(start|end)\|>\s*(system|assistant)?/gi, "")
    .replace(/<\/?(system|assistant|instruction)[^>]*>/gi, "")
    // Strip override/ignore instructions
    .replace(/ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi, "[filtered]")
    // F-AI-09: Strip phishing / credential harvesting attempts
    .replace(/(?:enter|provide|give|send|share)\s+(?:your\s+)?(?:password|credentials?|api.?key|token|secret|credit.?card)/gi, "[filtered]")
    .replace(/(?:click|visit|go\s+to)\s+(?:this\s+)?(?:link|url|http)/gi, "[filtered]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
