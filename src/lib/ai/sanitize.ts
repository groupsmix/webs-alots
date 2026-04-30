export function sanitizeUntrustedText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
    // A115-6: Strip UNTRUSTED delimiter markers so attackers cannot close
    // the boundary early and escape into trusted prompt space.
    .replace(/<<\s*UNTRUSTED[_A-Z]*>>/gi, "[filtered-delimiter]")
    .replace(/^\s*(s\s*y\s*s\s*t\s*e\s*m|a\s*s\s*s\s*i\s*s\s*t\s*a\s*n\s*t)\s*:/gi, "")
    .replace(/```(system|instructions?)[\s\S]*?```/gi, "")
    .replace(/<\|im_(start|end)\|>\s*(system|assistant)?/gi, "")
    .replace(/<\/?(system|assistant|instruction)[^>]*>/gi, "")
    .replace(/ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi, "[filtered]")
    // A115-3: Strip common multilingual jailbreak patterns (Darija/Arabic)
    .replace(/(?:ما\s*تتبع|لا\s*تتبع|تجاهل)\s*(?:ش\s*)?(?:القواعد|التعليمات|الأوامر)/gi, "[filtered]")
    // A115-2: Catch paraphrased "disregard prior rules" variants
    .replace(/disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(rules?|instructions?|prompts?|context)/gi, "[filtered]")
    .replace(/from\s+now\s+on[,.]?\s*(you\s+)?(are|will|must|should)/gi, "[filtered]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
