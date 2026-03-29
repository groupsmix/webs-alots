/**
 * Shared timezone utilities for clinic date/time operations.
 *
 * Uses `Intl.DateTimeFormat.formatToParts` for reliable timezone offset
 * extraction, avoiding the locale-dependent `toLocaleString` parsing that
 * can break across runtimes and during DST transitions.
 *
 * Morocco's DST rules are particularly complex (DST is suspended during
 * Ramadan, creating 4 transitions per year), so robust timezone handling
 * is critical.
 */

import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { logger } from "@/lib/logger";

/**
 * Build a timezone-aware Date for a date + time string using the clinic's timezone.
 *
 * Uses a two-pass approach: first computes the offset at the naive UTC instant,
 * then re-checks the offset at the corrected instant to handle DST transitions
 * where the offset differs between the two.
 *
 * @param dateStr  Date in YYYY-MM-DD format
 * @param timeStr  Time in HH:MM format
 * @param timezone IANA timezone (e.g. "Africa/Casablanca"). Must be provided
 *                 from the tenant's DB config — never from static clinicConfig.
 */
export function clinicDateTime(dateStr: string, timeStr: string, timezone?: string): Date {
  const tz = timezone ?? DEFAULT_TIMEZONE;
  if (!timezone) {
    logger.warn("clinicDateTime called without timezone — using DEFAULT_TIMEZONE fallback", { context: "timezone" });
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const get = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  // Pass 1: Start with a naive UTC interpretation of the date/time
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts1 = formatter.formatToParts(new Date(naiveUtc));
  const tzWall1 = Date.UTC(
    get(parts1, "year"),
    get(parts1, "month") - 1,
    get(parts1, "day"),
    get(parts1, "hour"),
    get(parts1, "minute"),
    get(parts1, "second"),
  );
  const offset1 = tzWall1 - naiveUtc;
  const candidate = new Date(naiveUtc - offset1);

  // Pass 2: Re-check the offset at the corrected instant to handle DST boundaries
  const parts2 = formatter.formatToParts(candidate);
  const tzWall2 = Date.UTC(
    get(parts2, "year"),
    get(parts2, "month") - 1,
    get(parts2, "day"),
    get(parts2, "hour"),
    get(parts2, "minute"),
    get(parts2, "second"),
  );
  const offset2 = tzWall2 - candidate.getTime();

  // If offsets differ (DST transition), use the second (corrected) offset
  if (offset1 !== offset2) {
    return new Date(naiveUtc - offset2);
  }

  return candidate;
}

/**
 * Compute the end time from a start time and duration in minutes.
 * Returns the end time string and whether it overflows past midnight.
 */
export function computeEndTime(
  startTime: string,
  durationMin: number,
): { endTime: string; overflows: boolean } {
  const [hh, mm] = startTime.split(":").map(Number);
  const endMinutes = hh * 60 + mm + durationMin;

  if (endMinutes >= 24 * 60) {
    return { endTime: "23:59", overflows: true };
  }

  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  return {
    endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
    overflows: false,
  };
}
