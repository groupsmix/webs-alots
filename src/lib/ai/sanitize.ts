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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
