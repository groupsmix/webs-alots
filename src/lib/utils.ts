import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Return a YYYY-MM-DD string in the given IANA timezone (defaults to
 * Africa/Casablanca — the primary deployment locale).
 *
 * Using `Intl.DateTimeFormat` avoids adding a third-party dependency while
 * correctly handling DST transitions that `.toISOString().split("T")[0]`
 * gets wrong (e.g. 23:30 local on March 15 → March 16 in UTC).
 */
export function getLocalDateStr(
  date: Date = new Date(),
  timezone = "Africa/Casablanca",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}
