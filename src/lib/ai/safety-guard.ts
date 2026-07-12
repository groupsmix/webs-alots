/**
 * AI safety guard — blocks diagnostic / clinical decision-making requests.
 *
 * Lane-A policy: AI is restricted to internal tooling (site builder, support
 * triage, non-diagnostic FAQ). Requests that ask for a diagnosis, prescription,
 * treatment recommendation, or triage based on symptoms are refused.
 */

const DIAGNOSTIC_DENYLIST = [
  /diagnost?ic/i,
  /prescri/i,
  /trai?tement\s+(?:pour|de|contre|a?prescrire)/i,
  /ordonnance/i,
  /medicament\s+(?:pour|contre|de)/i,
  /maladie\s+(?:j'ai|j ai|j'aurais|j aurais|ai-je|est-ce que)/i,
  /symptomes?\s+(?:j'ai|j ai|j'aurais|j aurais|ai-je|est-ce que)/i,
  /(?:what|which)\s+(?:disease|condition|diagnosis|medicine|treatment|drug)/i,
  /(?:diagnose|prescribe|treat)\s+(?:me|my|this|the|a)/i,
  /(?:doctor|medical)\s+(?:diagnosis|prescription|treatment)/i,
  /شنو\s+(?:مرض|ديالي|عندي|هاد|هذ|هادا|هذا)/i,
  /علاج\s+(?:ديالي|عندي|هاد|هذ|هادا|هذا)/i,
  /وصفة\s+(?:طبية|دواء|علاج)/i,
  /دواء\s+(?:عندي|ديالي|لي|هاد|هذ|هادا|هذا)/i,
];

const ALLOWED_INTERNAL_TASKS = new Set([
  "site builder",
  "website",
  "template",
  "branding",
  "support",
  "triage",
  "faq",
  "summarize",
  "translate",
  "code",
  "analyze",
  "reason",
  "classify",
  "generate",
  "conversation",
]);

export function isDiagnosticRequest(text: string): boolean {
  const lower = text.toLowerCase();
  if (ALLOWED_INTERNAL_TASKS.has(lower.trim())) return false;
  return DIAGNOSTIC_DENYLIST.some((pattern) => pattern.test(text));
}

export const NON_DIAGNOSTIC_POLICY =
  "\n\nPOLICY: You must NOT provide medical diagnoses, prescribe treatments, or make clinical decisions. " +
  "You may only help with internal tooling, support triage, non-diagnostic FAQ, site building, or operational analytics. " +
  "If a request requests health advice, refuse and direct the user to a qualified healthcare professional.";
