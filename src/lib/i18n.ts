export type Locale = "fr" | "ar" | "en";

// Instead of putting all translations in this file, we dynamically import them.
// We'll provide a synchronous `t` function that relies on pre-loaded dictionaries in React Context,
// or a simple cache that we load via a client component.
// However, since `t` is currently used synchronously everywhere, let's just load the JSON directly here.
// Next.js will bundle them, but at least they are split in separate files which can be optimized later
// via a proper i18n library (like next-intl). For now, we will maintain the existing API.

import ar from "../locales/ar.json";
import en from "../locales/en.json";
import fr from "../locales/fr.json";

export type TranslationKey = keyof typeof fr;

export const translations = {
  fr,
  ar,
  en
} as const;

export function t(locale: Locale, key: TranslationKey | string, params?: Record<string, string | number>): string {
  const dict = translations[locale] || translations.fr;
  let text = dict[key as keyof typeof dict] as string;

  if (!text) {
    // Fallback to French
    text = translations.fr[key as keyof typeof translations.fr] as string;
    if (!text) return key;
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, "g"), String(v));
    });
  }

  return text;
}

export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return isRTL(locale) ? "rtl" : "ltr";
}
