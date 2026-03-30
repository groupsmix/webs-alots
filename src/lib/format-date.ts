import type { Locale } from "@/lib/i18n";

/**
 * Consistent date formatting utility (issue #30).
 *
 * Uses `Intl.DateTimeFormat` so output respects the user's locale.
 * Moroccan users typically expect dd/MM/yyyy or "15 mars 2026".
 */

const LOCALE_MAP: Record<Locale, string> = {
  fr: "fr-MA",
  ar: "ar-MA",
  en: "en-US",
};

/** Short numeric date, e.g. 15/03/2026 */
export function formatDateShort(date: Date | string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Long date, e.g. "15 mars 2026" */
export function formatDateLong(date: Date | string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Date with time, e.g. "15 mars 2026, 14:30" */
export function formatDateTime(date: Date | string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Relative time, e.g. "il y a 5 min" / "dans 2 jours" */
export function formatRelative(date: Date | string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const absDiff = Math.abs(diffMs);
  const past = diffMs > 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  const rtf = new Intl.RelativeTimeFormat(LOCALE_MAP[locale], { numeric: "auto" });

  if (minutes < 1) return rtf.format(0, "minute");
  if (minutes < 60) return rtf.format(past ? -minutes : minutes, "minute");
  if (hours < 24) return rtf.format(past ? -hours : hours, "hour");
  if (days < 7) return rtf.format(past ? -days : days, "day");

  // Fall back to absolute date for anything older than a week
  return formatDateShort(d, locale);
}
