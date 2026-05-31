/**
 * A73-F3: AI prompt size limits and safety caps.
 *
 * Problem:
 *   A large patient history (many consultations, prescriptions, vitals) could
 *   generate a prompt exceeding model context limits, causing truncation, errors,
 *   or cost spikes. No explicit cap existed in the codebase.
 *
 * Solution:
 *   - Define a hard token/character budget per route type
 *   - Provide a truncation helper that shrinks input context to fit the budget
 *   - Enforce via the prompt builder functions in each AI route
 *
 * Token estimation:
 *   GPT-4o-mini: ~4 characters per token (rough estimate for multilingual text).
 *   We use characters as a proxy to avoid importing a full tokenizer.
 */

/** Maximum number of characters for a combined system + user prompt. */
export const MAX_PROMPT_CHARS = {
  /** Patient summary — moderate context */
  patient_summary: 12_000,
  /** Drug interaction check — medication list only */
  drug_interactions: 4_000,
  /** Prescription auto-suggest — diagnosis + recent Rx */
  prescription_suggest: 6_000,
  /** Referral letter generation — full patient context */
  referral_letter: 16_000,
  /** Lab result pre-read — lab data only */
  lab_preread: 8_000,
  /** General chat / receptionist */
  chat: 8_000,
  /** Default fallback cap */
  default: 10_000,
} as const;

export type PromptContext = keyof typeof MAX_PROMPT_CHARS;

/**
 * Truncate a text string to fit within a maximum character budget.
 * Appends a truncation notice so the model knows the input was clipped.
 */
export function truncatePromptContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  // Cut at the last newline to avoid breaking in the middle of a sentence
  const lastNewline = truncated.lastIndexOf("\n");
  const cutPoint = lastNewline > maxChars * 0.8 ? lastNewline : maxChars;
  return (
    text.slice(0, cutPoint) +
    "\n\n[... contexte tronqué pour respecter la limite de longueur du modèle ...]"
  );
}

/**
 * Assert that a prompt fits within the allowed budget for its context.
 * Returns { ok: true } if safe, { ok: false, truncated: string } if it was clipped.
 *
 * Routes SHOULD prefer `truncatePromptContext` to hard-fail so that a large
 * patient file still produces a partial summary rather than a 400 error.
 */
export function capPrompt(
  prompt: string,
  context: PromptContext = "default",
): { ok: true; prompt: string } | { ok: false; prompt: string; originalLength: number } {
  const limit = MAX_PROMPT_CHARS[context] ?? MAX_PROMPT_CHARS.default;
  if (prompt.length <= limit) {
    return { ok: true, prompt };
  }
  return {
    ok: false,
    prompt: truncatePromptContext(prompt, limit),
    originalLength: prompt.length,
  };
}
