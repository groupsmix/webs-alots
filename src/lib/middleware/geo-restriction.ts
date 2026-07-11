/**
 * A36.7: Geo-restriction helper for admin endpoints.
 *
 * The platform handles Moroccan PHI; restricting admin-panel access to
 * expected geographies is a defensible default. Cloudflare injects the
 * `CF-IPCountry` header on every request with the ISO 3166-1 alpha-2
 * country code of the client.
 *
 * Behaviour:
 *   - Geo-restriction is **enabled by default**. Set
 *     `ADMIN_GEO_RESTRICTION_ENABLED=false` to disable.
 *   - When enabled, admin routes are restricted to Morocco (`MA`) unless
 *     `GEO_RESTRICT_ADMIN` overrides the allowed country list with a
 *     comma-separated set of codes (e.g. "MA,FR,ES").
 *   - The `CF-IPCountry` header is only present on Cloudflare-proxied
 *     requests. In dev/staging without Cloudflare, the check is skipped.
 *   - Patient-facing routes are never restricted.
 *
 * This is defense-in-depth: authentication and RBAC remain the primary
 * access controls.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isAdminGeoRestrictionEnabled, getGeoRestrictAdminCountries } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Admin route prefixes that should be geo-restricted. */
const ADMIN_PREFIXES = ["/admin", "/dashboard", "/api/admin"] as const;

let _allowedCountries: Set<string> | null | undefined;

function getAllowedCountries(): Set<string> | null {
  if (_allowedCountries !== undefined) return _allowedCountries;

  if (!isAdminGeoRestrictionEnabled()) {
    _allowedCountries = null;
    return null;
  }

  const raw = getGeoRestrictAdminCountries();
  if (!raw || raw.trim() === "") {
    _allowedCountries = new Set(["MA"]);
    return _allowedCountries;
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
  const isAdminRoute = ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

    // For browser page navigations (e.g. /dashboard, /admin) return a clear,
    // self-explanatory HTML page instead of a raw JSON blob. A JSON 403 on a
    // top-level navigation renders as a broken/blank page and looks like the
    // app is "dead" — the operator has no idea their location is the cause.
    // API/fetch requests keep the JSON 403 so client error-handling (which
    // already detects `code: "GEO_RESTRICTED"`) is unchanged.
    const accept = request.headers.get("accept") ?? "";
    const isApiRoute = pathname.startsWith("/api");
    const isNavigation = !isApiRoute && accept.includes("text/html");

    if (isNavigation) {
      return new NextResponse(geoBlockedHtml(upper), {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json(
      { error: "Access denied from your location", code: "GEO_RESTRICTED", country: upper },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Self-contained HTML for a geo-blocked admin navigation. No external assets
 * or inline scripts, so it is safe under the strict CSP. Bilingual (FR/EN)
 * because the platform's operators are in Morocco but support may be elsewhere.
 */
function geoBlockedHtml(country: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Accès restreint depuis votre région · Oltigo</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:#f4f1ea; color:#0b0f0e; padding:24px; }
  .card { max-width:30rem; width:100%; background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:14px;
    padding:32px; box-shadow:0 10px 30px rgba(0,0,0,.06); }
  h1 { font-size:1.25rem; margin:0 0 12px; }
  p { font-size:.95rem; line-height:1.55; margin:0 0 12px; color:#33403c; }
  .muted { font-size:.8rem; color:#6b7672; margin-top:20px; }
  code { background:#f0ede6; padding:1px 6px; border-radius:5px; }
</style>
</head>
<body>
  <main class="card" role="main">
    <h1>Accès restreint depuis votre région</h1>
    <p>Pour des raisons de sécurité, l'espace d'administration d'Oltigo n'est accessible
       que depuis certaines régions. Votre connexion semble provenir de
       <code>${country}</code>, qui n'est pas autorisée.</p>
    <p><strong>English:</strong> For security reasons, the Oltigo admin area is restricted
       to specific regions. Your connection appears to originate from
       <code>${country}</code>, which is not allowed.</p>
    <p>Si vous êtes l'administrateur et devez accéder depuis cette région, ajoutez votre
       pays à <code>GEO_RESTRICT_ADMIN</code> (ou définissez
       <code>ADMIN_GEO_RESTRICTION_ENABLED=false</code>) dans la configuration du déploiement.</p>
    <p class="muted">Code: GEO_RESTRICTED · Oltigo</p>
  </main>
</body>
</html>`;
}
