/**
 * F-A198 / F-A160: Sanctioned country blocking.
 *
 * Blocks requests from OFAC/EU/UN-sanctioned jurisdictions at the
 * middleware level using Cloudflare's request.cf.country geolocation.
 *
 * This is a first-line defense. Full sanctions screening (OFAC SDN list
 * checks against patient/clinic names) requires a dedicated service and
 * is tracked separately.
 *
 * ISO 3166-1 alpha-2 codes for comprehensively sanctioned countries
 * (as of 2024-Q4 — review quarterly):
 */

import { NextResponse } from "next/server";

/**
 * Countries under comprehensive US (OFAC), EU, and UN sanctions.
 * Sources: US Treasury OFAC, EU Council Regulation, UN Security Council.
 * Review this list quarterly and after any new sanctions announcement.
 */
export const SANCTIONED_COUNTRIES = new Set([
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea (DPRK)
  "SY", // Syria
  "RU", // Russia (comprehensive since 2022)
]);

/**
 * Check if a request originates from a sanctioned jurisdiction.
 * Returns a 451 (Unavailable For Legal Reasons) response if blocked,
 * or null if the request should proceed.
 *
 * Requires Cloudflare Workers runtime (request.cf.country).
 * Falls through silently if geolocation data is unavailable (e.g. local dev).
 */
export function checkSanctionedCountry(
  request: Request,
): NextResponse | null {
  // Cloudflare Workers expose geolocation on request.cf
  const cf = (request as unknown as { cf?: { country?: string } }).cf;
  const country = cf?.country;

  if (!country) return null; // No geo data (local dev, non-CF environment)

  if (SANCTIONED_COUNTRIES.has(country)) {
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: "Service unavailable in your region",
        code: "REGION_BLOCKED",
      }),
      {
        status: 451, // Unavailable For Legal Reasons
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return null;
}
