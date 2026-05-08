/**
 * A36.7: Geo-restriction middleware for admin endpoints.
 *
 * The platform handles Moroccan PHI; restricting admin-panel access to
 * expected geographies is a defensible default. Cloudflare injects the
 * `CF-IPCountry` header on every request with the ISO 3166-1 alpha-2
 * country code of the client.
 *
 * Behaviour:
 *   - When `GEO_RESTRICT_ADMIN` env var is set to a comma-separated list
 *     of country codes (e.g. "MA,FR,ES"), requests to admin dashboard
 *     routes from outside those countries receive a 403.
 *   - When `GEO_RESTRICT_ADMIN` is unset or empty, geo-restriction is
 *     disabled (fail-open for backward compatibility).
 *   - The `CF-IPCountry` header is only present on Cloudflare-proxied
 *     requests. In dev/staging without Cloudflare, the check is skipped.
 *
 * This is defense-in-depth: authentication and RBAC remain the primary
 * access controls.
 */
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";

/** Admin route prefixes that should be geo-restricted. */
const ADMIN_PREFIXES = [
  "/admin",
  "/dashboard",
  "/api/admin",
] as const;

let _allowedCountries: Set<string> | null | undefined;

function getAllowedCountries(): Set<string> | null {
  if (_allowedCountries !== undefined) return _allowedCountries;
  const raw = process.env.GEO_RESTRICT_ADMIN;
  if (!raw || raw.trim() === "") {
    _allowedCountries = null;
    return null;
  }
  _allowedCountries = new Set(
    raw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );
  return _allowedCountries;
}

/**
 * Check geo-restriction for admin endpoints.
 * Returns a 403 NextResponse if blocked, or null if allowed.
 */
export function checkGeoRestriction(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const isAdminRoute = ADMIN_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (!isAdminRoute) return null;

  const allowed = getAllowedCountries();
  if (!allowed) return null; // Geo-restriction disabled

  const country = request.headers.get("cf-ipcountry");
  if (!country) {
    // No CF-IPCountry header — not on Cloudflare (dev/staging). Skip.
    return null;
  }

  const upper = country.toUpperCase();
  // "T1" is Cloudflare's code for Tor exit nodes — always block on admin.
  if (upper === "T1" || !allowed.has(upper)) {
    logger.warn("Geo-restricted admin access attempt", {
      context: "geo-restriction",
      country: upper,
      pathname,
    });
    return NextResponse.json(
      { error: "Access denied from your location", code: "GEO_RESTRICTED" },
      { status: 403 },
    );
  }

  return null;
}
