/**
 * A72-F2: AI-generated content disclaimers.
 *
 * The EU AI Act requires that AI-generated content is clearly labelled.
 * All AI outputs (prescription drafts, patient summaries, manager insights)
 * must include a visible disclaimer so clinicians review before acting.
 *
 * Usage: prepend `AI_DISCLAIMER` to any AI-generated text block, or render
 * `AI_DISCLAIMER_HTML` in UI components that display AI output.
 */

/** Plain-text disclaimer for API JSON responses and WhatsApp messages. */
export const AI_DISCLAIMER =
  "⚠️ AI-generated draft — review before use. This content was produced by an AI model and may contain errors.";

/** French-language variant for the default UI locale. */
export const AI_DISCLAIMER_FR =
  "⚠️ Brouillon généré par IA — à vérifier avant utilisation. Ce contenu a été produit par un modèle d'IA et peut contenir des erreurs.";

/** Arabic-language variant. */
export const AI_DISCLAIMER_AR =
  "⚠️ مسودة مُنشأة بالذكاء الاصطناعي — يُرجى المراجعة قبل الاستخدام. قد يحتوي هذا المحتوى على أخطاء.";

/** Map of locale to disclaimer string. */
export const AI_DISCLAIMER_I18N: Record<string, string> = {
  en: AI_DISCLAIMER,
  fr: AI_DISCLAIMER_FR,
  ar: AI_DISCLAIMER_AR,
};

/**
 * Get the appropriate AI disclaimer for a given locale.
 * Falls back to French (default UI language).
 */
export function getAIDisclaimer(locale: string): string {
  return AI_DISCLAIMER_I18N[locale] ?? AI_DISCLAIMER_FR;
}
