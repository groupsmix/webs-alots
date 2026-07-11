/**
 * Lightweight language detection for FR/AR/EN.
 * Uses character-range heuristics and keyword frequency — no external API needed.
 */

import type { SupportedLanguage } from "@/lib/validations/support";

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const ARABIC_THRESHOLD = 0.3;

const FR_KEYWORDS = new Set([
  "le",
  "la",
  "les",
  "de",
  "des",
  "un",
  "une",
  "du",
  "au",
  "aux",
  "je",
  "tu",
  "il",
  "elle",
  "nous",
  "vous",
  "ils",
  "elles",
  "est",
  "sont",
  "avoir",
  "être",
  "faire",
  "avec",
  "pour",
  "dans",
  "sur",
  "pas",
  "que",
  "qui",
  "mais",
  "ou",
  "et",
  "bonjour",
  "merci",
  "rendez-vous",
  "docteur",
  "médecin",
  "clinique",
  "cabinet",
]);

const EN_KEYWORDS = new Set([
  "the",
  "is",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "could",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "it",
  "my",
  "your",
  "his",
  "her",
  "our",
  "their",
  "this",
  "that",
  "what",
  "when",
  "where",
  "how",
  "why",
  "appointment",
  "doctor",
  "clinic",
  "booking",
  "hello",
  "thanks",
]);

export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) return "fr";

  const chars = [...text];
  const arabicCount = chars.filter((c) => ARABIC_RANGE.test(c)).length;
  if (arabicCount / chars.length > ARABIC_THRESHOLD) return "ar";

  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  let frScore = 0;
  let enScore = 0;

  for (const word of words) {
    if (FR_KEYWORDS.has(word)) frScore++;
    if (EN_KEYWORDS.has(word)) enScore++;
  }

  if (enScore > frScore && enScore >= 2) return "en";
  return "fr";
}
