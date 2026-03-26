import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatInTimeZone } from "date-fns-tz"

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
  timezone = "Africa/Casablanca",
): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}
