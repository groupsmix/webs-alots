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

// ── F-A92-01: CLDR plural rules ────────────────────────────────────────
// Intl.PluralRules implements the full ICU/CLDR plural category set:
//   en: "one" | "other"
//   fr: "one" | "many" | "other"
//   ar: "zero" | "one" | "two" | "few" | "many" | "other"
//
// Translation keys follow the pattern: "key_zero", "key_one", "key_two",
// "key_few", "key_many", "key_other". Falls back to "key_other" if a
// specific plural form is missing, then to the base key.

const pluralRules: Record<Locale, Intl.PluralRules> = {
  fr: new Intl.PluralRules("fr"),
  ar: new Intl.PluralRules("ar"),
  en: new Intl.PluralRules("en"),
};

/**
 * Translate a key with optional parameter substitution.
 *
 * Supports CLDR plural rules when a `count` parameter is provided:
 *   t("fr", "appointment", { count: 5 })
 *   → looks up "appointment_other" (fr plural for 5 is "other")
 *   → falls back to "appointment" if plural key missing
 */
export function t(locale: Locale, key: TranslationKey | string, params?: Record<string, string | number>): string {
  const dict = translations[locale] || translations.fr;

  // F-A92-01: If `count` is provided, resolve the CLDR plural form first.
  let resolvedKey = key;
  if (params && "count" in params) {
    const count = Number(params.count);
    const rule = pluralRules[locale] ?? pluralRules.fr;
    const category = rule.select(count); // "zero" | "one" | "two" | "few" | "many" | "other"
    const pluralKey = `${key}_${category}`;
    // Try the plural-specific key; fall back to base key
    if ((dict as Record<string, string>)[pluralKey]) {
      resolvedKey = pluralKey;
    } else if ((translations.fr as Record<string, string>)[pluralKey]) {
      resolvedKey = pluralKey;
    }
  }

  let text = (dict as Record<string, string>)[resolvedKey as string];

  if (!text) {
    // Fallback to French
    text = (translations.fr as Record<string, string>)[resolvedKey as string];
    if (!text) {
      // Fall back to base key if plural key not found
      text = (dict as Record<string, string>)[key as string]
        ?? (translations.fr as Record<string, string>)[key as string]
        ?? key;
    }
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
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

// ── F-A92-03: Locale-aware formatting utilities ────────────────────────

/** Locale to BCP 47 tag mapping */
const BCP47: Record<Locale, string> = {
  fr: "fr-MA",
  ar: "ar-MA",
  en: "en-US",
};

/**
 * Format a date for display using the locale's conventions.
 * Uses Intl.DateTimeFormat for proper locale-aware formatting.
 *
 * @example
 *   formatDate("fr", new Date("2026-05-01")) // "1 mai 2026"
 *   formatDate("ar", new Date("2026-05-01")) // "١ مايو ٢٠٢٦"
 */
export function formatDate(
  locale: Locale,
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const defaults: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Casablanca",
    ...options,
  };
  return new Intl.DateTimeFormat(BCP47[locale], defaults).format(d);
}

/**
 * Format a number for display using locale conventions.
 *
 * @example
 *   formatNumber("fr", 1234.5)  // "1 234,5"
 *   formatNumber("ar", 1234.5)  // "١٬٢٣٤٫٥"
 */
export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(BCP47[locale], options).format(value);
}

/**
 * Format a currency amount in MAD (Moroccan Dirham).
 * Uses Intl.NumberFormat for proper locale-aware currency display.
 *
 * @example
 *   formatCurrency("fr", 250)   // "250,00 MAD"
 *   formatCurrency("ar", 250)   // "٢٥٠٫٠٠ د.م."
 *   formatCurrency("en", 250)   // "MAD 250.00"
 */
export function formatCurrency(
  locale: Locale,
  amount: number,
  currency = "MAD",
): string {
  return new Intl.NumberFormat(BCP47[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a relative time (e.g., "3 hours ago", "in 2 days").
 *
 * @example
 *   formatRelativeTime("fr", -3, "hour")  // "il y a 3 heures"
 *   formatRelativeTime("ar", -1, "day")   // "أمس"
 */
export function formatRelativeTime(
  locale: Locale,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  return new Intl.RelativeTimeFormat(BCP47[locale], { numeric: "auto" }).format(value, unit);
}
