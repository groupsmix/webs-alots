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
 * F-AI-11: Detects system prompt extraction attempts.
 * F-AI-12: Detects multilingual injection (FR/AR/Darija).
 * F-AI-13: Detects base64/ROT13 encoded injection attempts.
 *
 * A108-3: Emits a structured `ai.guardrail.triggered` log event when
 * injection content is stripped, enabling abuse-rate metrics.
 *
 * DEFENCE-IN-DEPTH ONLY — this is not a security boundary. Primary
 * protection comes from labelling user content as "user" turns and
 * system prompt instruction-following directives.
 */

import { logger } from "@/lib/logger";

// F-AI-11: System prompt extraction patterns
const EXTRACTION_PATTERNS = [
  /(?:repeat|show|display|output|print|reveal|write)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|guidelines?)/gi,
  /(?:what|tell\s+me)\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/gi,
  /(?:quelles?\s+sont|montre|affiche|donne)\s+(?:tes|vos)\s+(?:instructions?|règles?|consignes?|directives?)/gi,
  /(?:ما|اعرض|اظهر|اكتب)\s+(?:هي\s+)?(?:تعليماتك|قواعدك|تعليمات النظام)/gi,
  /(?:wri|goul(?:ia)?)\s+(?:les?\s+)?(?:instructions?|9awa3id|ta3limat)/gi,
];

// F-AI-12: Multilingual injection override patterns
const MULTILINGUAL_OVERRIDE_PATTERNS = [
  // French
  /ignore[rz]?\s+(?:les?\s+)?instructions?\s+(?:précédentes?|antérieures?|ci-dessus)/gi,
  /oublie[rz]?\s+(?:toutes?\s+)?(?:les?\s+)?(?:règles?|instructions?|consignes?)/gi,
  /(?:tu\s+es|vous\s+êtes)\s+(?:maintenant|désormais)\s+(?:un|une)\s+(?:IA|assistant)/gi,
  // Arabic
  /تجاهل\s+(?:كل\s+)?(?:التعليمات|القواعد)\s+(?:السابقة|القديمة)/gi,
  /انسَ?\s+(?:كل\s+)?(?:القواعد|التعليمات)/gi,
  /أنت\s+الآن\s+(?:مساعد|طبيب)\s+(?:بدون|بلا)\s+(?:قيود|حدود)/gi,
  // Darija
  /khal\s+(?:les?\s+)?instructions?\s+(?:l9dim|qdim|dyal\s+9bel)/gi,
  /nsa\s+(?:ga3\s+)?(?:l9awa3id|les?\s+règles?|instructions?)/gi,
  /(?:nta|anta)\s+daba\s+(?:tbib|assistant|IA)\s+bla\s+(?:7doud|9youd|limites?)/gi,
];

// F-AI-13: Base64 detection — suspicious long base64 strings (>40 chars)
const BASE64_PATTERN = /(?:[A-Za-z0-9+/]{40,}={0,2})/g;

/**
 * F-AI-13: Detect if a string contains suspicious base64 content
 * that, when decoded, resembles prompt injection.
 */
function containsSuspiciousBase64(s: string): boolean {
  const matches = s.match(BASE64_PATTERN);
  if (!matches) return false;
  for (const match of matches) {
    try {
      const decoded = Buffer.from(match, "base64").toString("utf-8");
      // Check if decoded content looks like injection
      if (
        /(?:ignore|system|assistant|prompt|instructions?)/i.test(decoded) ||
        /(?:تجاهل|تعليمات)/i.test(decoded)
      ) {
        return true;
      }
    } catch {
      // Not valid base64, skip
    }
  }
  return false;
}

/**
 * F-AI-13: Detect ROT13-encoded injection attempts.
 */
function containsSuspiciousRot13(s: string): boolean {
  // Only check strings that look like they might be ROT13 (mostly alpha)
  const alphaRatio = (s.match(/[a-zA-Z]/g)?.length ?? 0) / Math.max(s.length, 1);
  if (alphaRatio < 0.7) return false;

  const decoded = s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
  return /(?:ignore|system|assistant|prompt|instructions?)/i.test(decoded);
}

export function sanitizeUntrustedText(s: string | null | undefined): string {
  if (!s) return "";

  const original = s;

  let result = s
    .normalize("NFKC")
    // Strip zero-width / invisible characters
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
    // F-AI-06 / A101-2: Strip ALL UNTRUSTED delimiter marker variants.
    // The prompt templates use <<UNTRUSTED_PATIENT_INPUT_BEGIN/END>> to
    // fence user content. If an attacker injects these markers they can
    // close the fence early and inject trusted-mode instructions.
    .replace(/<<\s*UNTRUSTED[^>]*>>/gi, "")
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
    .replace(
      /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi,
      "[filtered]",
    )
    // F-AI-09: Strip phishing / credential harvesting attempts
    .replace(
      /(?:enter|provide|give|send|share)\s+(?:your\s+)?(?:password|credentials?|api.?key|token|secret|credit.?card)/gi,
      "[filtered]",
    )
    .replace(/(?:click|visit|go\s+to)\s+(?:this\s+)?(?:link|url|http)/gi, "[filtered]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // F-AI-11: Detect system prompt extraction attempts
  for (const pattern of EXTRACTION_PATTERNS) {
    result = result.replace(pattern, "[filtered]");
  }

  // F-AI-12: Detect multilingual injection override patterns
  for (const pattern of MULTILINGUAL_OVERRIDE_PATTERNS) {
    result = result.replace(pattern, "[filtered]");
  }

  // F-AI-13: Flag base64-encoded injection
  if (containsSuspiciousBase64(result)) {
    logger.warn("ai.guardrail.triggered", {
      context: "ai-input-sanitiser",
      guardrail: "base64_injection",
      action: "flagged",
    });
    result = result.replace(BASE64_PATTERN, "[encoded-content-removed]");
  }

  // F-AI-13: Flag ROT13-encoded injection (check individual words > 10 chars)
  const words = result.split(/\s+/);
  const rot13Detected = words.some((w) => w.length > 10 && containsSuspiciousRot13(w));
  if (rot13Detected) {
    logger.warn("ai.guardrail.triggered", {
      context: "ai-input-sanitiser",
      guardrail: "rot13_injection",
      action: "flagged",
    });
  }

  // A108-3: Log when sanitisation materially changed the input
  if (
    result !==
    original
      .normalize("NFKC")
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  ) {
    logger.warn("ai.guardrail.triggered", {
      context: "ai-input-sanitiser",
      guardrail: "injection_strip",
      action: "sanitised",
    });
  }

  return result;
}
