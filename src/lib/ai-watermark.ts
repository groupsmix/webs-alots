/**
 * AI Content Watermarking Utilities
 *
 * A72-F2: AI Act Art.50, Moroccan Law 09-08 Art.6
 *
 * All AI-generated clinical content must be:
 * 1. Visibly labeled as AI-generated before use
 * 2. Include a review-before-use disclaimer
 * 3. Be distinguishable from human-authored content in exports/printouts
 *
 * This module provides:
 * - `watermarkAiContent(text)` — prepend/append watermark to AI text
 * - `AI_WATERMARK_PREFIX` — the canonical prefix constant
 * - `isWatermarked(text)` — detect if content is already watermarked
 * - `stripWatermark(text)` — remove watermark for downstream processing
 *
 * Usage in AI routes (after receiving the AI response):
 *   const watermarked = watermarkAiContent(aiResponse, "prescription");
 *   return apiSuccess({ content: watermarked, disclaimer: AI_RESPONSE_DISCLAIMER });
 */

/** The canonical watermark prefix for AI-generated content. */
export const AI_WATERMARK_PREFIX = "⚠️ [IA - PROJET - À RÉVISER AVANT UTILISATION]";

/** English fallback for international contexts. */
export const AI_WATERMARK_PREFIX_EN = "⚠️ [AI DRAFT - REVIEW BEFORE USE]";

/**
 * Content type labels for the watermark — helps auditors identify the
 * AI feature that generated the content.
 */
export const AI_CONTENT_TYPES = {
  prescription: "ORDONNANCE IA",
  "drug-check": "VÉRIFICATION INTERACTIONS IA",
  "patient-summary": "RÉSUMÉ PATIENT IA",
  chat: "RÉPONSE IA",
  general: "CONTENU IA",
} as const;

export type AiContentType = keyof typeof AI_CONTENT_TYPES;

/**
 * Watermark text prepended to all AI-generated clinical content.
 *
 * Format:
 *   ⚠️ [IA - PROJET - À RÉVISER AVANT UTILISATION | {TYPE}]
 *   ─────────────────────────────────────────────────────
 *   {content}
 *   ─────────────────────────────────────────────────────
 *   Ce contenu a été généré par intelligence artificielle. Il doit être
 *   revu et validé par un professionnel de santé qualifié avant toute
 *   utilisation clinique. (AI Act Art.50 / Loi 09-08)
 */
export function watermarkAiContent(
  content: string,
  type: AiContentType = "general",
): string {
  if (!content || content.trim().length === 0) return content;

  // Don't double-watermark
  if (isWatermarked(content)) return content;

  const typeLabel = AI_CONTENT_TYPES[type];
  const divider = "─".repeat(56);

  const header = `${AI_WATERMARK_PREFIX} | ${typeLabel}\n${divider}`;
  const footer = [
    divider,
    "Ce contenu a été généré par intelligence artificielle (IA).",
    "Il DOIT être revu et validé par un professionnel de santé",
    "qualifié avant toute utilisation clinique.",
    "Réf. réglementaire : EU AI Act Art.50 · Loi 09-08 Art.6",
  ].join("\n");

  return `${header}\n\n${content.trim()}\n\n${footer}`;
}

/**
 * Returns true if the text already contains the AI watermark prefix.
 * Prevents double-watermarking when content flows through multiple layers.
 */
export function isWatermarked(text: string): boolean {
  return (
    text.includes(AI_WATERMARK_PREFIX) ||
    text.includes(AI_WATERMARK_PREFIX_EN)
  );
}

/**
 * Strip the watermark from AI content for downstream processing.
 *
 * Use this only when:
 * - Comparing content for deduplication
 * - Re-processing content through another AI step
 * - Storing the canonical version (store watermarked version separately)
 *
 * Do NOT use this to strip watermarks from content shown to users.
 */
export function stripWatermark(text: string): string {
  if (!isWatermarked(text)) return text;

  // Remove header line (prefix + type label + divider)
  let result = text;

  // Remove the header watermark block
  result = result.replace(
    /⚠️ \[IA - PROJET - À RÉVISER AVANT UTILISATION\].*?\n─+\n\n/s,
    "",
  );
  result = result.replace(
    /⚠️ \[AI DRAFT - REVIEW BEFORE USE\].*?\n─+\n\n/s,
    "",
  );

  // Remove the footer watermark block
  result = result.replace(
    /\n\n─+\nCe contenu a été généré par intelligence artificielle.*?Loi 09-08 Art\.6/s,
    "",
  );

  return result.trim();
}

/**
 * Metadata object to attach to AI-generated records stored in the database.
 * Helps with future audits and data subject access requests.
 */
export function buildAiContentMetadata(
  type: AiContentType,
  model: string,
  clinicId: string,
  estimatedTokens?: number,
): Record<string, unknown> {
  return {
    ai_generated: true,
    ai_content_type: type,
    ai_model: model,
    ai_generated_at: new Date().toISOString(),
    ai_review_required: true,
    clinic_id: clinicId,
    ...(estimatedTokens !== undefined && { estimated_tokens: estimatedTokens }),
    regulatory_refs: ["EU AI Act Art.50", "Loi 09-08 Art.6", "Law 09-08 Art.6"],
  };
}
