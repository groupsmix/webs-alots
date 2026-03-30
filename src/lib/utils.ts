import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatInTimeZone } from "date-fns-tz"
import { DEFAULT_TIMEZONE } from "@/lib/constants"
import type { Locale } from "@/lib/i18n"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Return a YYYY-MM-DD string in the given IANA timezone (defaults to
 * Africa/Casablanca — the primary deployment locale).
 *
 * Uses date-fns-tz to correctly handle DST transitions that
 * `.toISOString().split("T")[0]` gets wrong (e.g. 23:30 local on
 * March 15 → March 16 in UTC).
 */
export function getLocalDateStr(
  date: Date = new Date(),
  timezone = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

// ── Consistent date formatting (Issue 30) ──

const LOCALE_MAP: Record<Locale, string> = {
  fr: "fr-FR",
  ar: "ar-MA",
  en: "en-US",
};

/**
 * Format a date string or Date for display, respecting the user's locale.
 *
 * Formats:
 *  - "short"    → 15/03/2026 (or locale equivalent)
 *  - "long"     → 15 mars 2026
 *  - "relative" → il y a 5 min / 2h ago / etc.
 *  - "time"     → 14:30
 *  - "datetime" → 15 mars 2026 à 14:30
 */
export type DateFormat = "short" | "long" | "relative" | "time" | "datetime";

export function formatDisplayDate(
  dateInput: string | Date,
  locale: Locale = "fr",
  format: DateFormat = "short",
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  const intlLocale = LOCALE_MAP[locale];

  switch (format) {
    case "short":
      return new Intl.DateTimeFormat(intlLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);

    case "long":
      return new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);

    case "time":
      return new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);

    case "datetime":
      return new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);

    case "relative":
      return formatRelativeTime(date, locale);
  }
}

/**
 * Format a date as a relative time string (e.g. "il y a 5 min", "2h ago").
 */
function formatRelativeTime(date: Date, locale: Locale): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const intlLocale = LOCALE_MAP[locale];

  // Use Intl.RelativeTimeFormat for proper locale support
  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
    if (diffMin < 1) return rtf.format(0, "second");
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    if (diffHr < 24) return rtf.format(-diffHr, "hour");
    if (diffDay < 7) return rtf.format(-diffDay, "day");
    if (diffDay < 30) return rtf.format(-Math.floor(diffDay / 7), "week");
  } catch {
    // Fallback if Intl.RelativeTimeFormat is unavailable
  }

  // Beyond ~1 month: show the short date
  return new Intl.DateTimeFormat(intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
