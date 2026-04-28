import { NextResponse } from "next/server";

/** OWASP-recommended HSTS max-age: 2 years (63 072 000 seconds). */
const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

/**
 * CSP reporting endpoint. In production, violations are sent to Sentry's
 * CSP reporting ingestion endpoint. The project ID and key should be
 * configured via the SENTRY_CSP_REPORT_URI environment variable.
 * Falls back to the app's own /api/csp-report endpoint for self-hosted
 * collection when Sentry is not configured.
 */
const CSP_REPORT_URI =
  process.env.SENTRY_CSP_REPORT_URI || "/api/csp-report";

/**
 * R-08: Derive the project-specific Supabase hostname from
 * NEXT_PUBLIC_SUPABASE_URL instead of allowing *.supabase.co.
 */
function getSupabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // fall through to default
    }
  }
  return "placeholder.supabase.co";
}

/**
 * Build the Content-Security-Policy header value with a per-request nonce.
 *
 * R-08: Wildcards (*.supabase.co, *.googleapis.com) replaced with the
 * project-specific Supabase hostname (derived from NEXT_PUBLIC_SUPABASE_URL)
 * and the exact Google endpoints the app uses.
 *
 * The first release ships these tighter directives under
 * Content-Security-Policy-Report-Only so violations are surfaced without
 * breaking users. Flip to enforcement after one release cycle with no
 * unexpected reports.
 */
export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const sbHost = getSupabaseHost();
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https: http:${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: ${sbHost} uploads.oltigo.com`,
    "font-src 'self'",
    // R-08 Fix: Added challenges.cloudflare.com for Turnstile widget
    `connect-src 'self' ${sbHost} wss://${sbHost} https://fonts.googleapis.com https://maps.googleapis.com https://www.googleapis.com/calendar https://cloudflareinsights.com https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
    // R-08 Fix: Added challenges.cloudflare.com for Turnstile iframe
    "frame-src 'self' https://challenges.cloudflare.com",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ...(isDev ? [] : [`report-uri ${CSP_REPORT_URI}`]),
    ...(isDev
      ? []
      : [`report-to csp-endpoint`]),
  ].join("; ");
}

/**
 * Apply defense-in-depth security headers to early-return error responses.
 */
export function withSecurityHeaders(
  response: NextResponse,
  cspHeaderValue: string,
): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeaderValue);
  response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

/**
 * Apply security headers to redirect responses.
 */
export function secureRedirect(url: string | URL, init?: number | ResponseInit): NextResponse {
  const response = NextResponse.redirect(url, init);
  response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

/**
 * Apply all standard security headers to a response.
 */
export function applyAllSecurityHeaders(
  response: NextResponse,
  cspHeaderValue: string,
  _nonce: string, // Unused but kept for API compatibility
): void {
  // R-08 Fix: Ship Report-Only for one release cycle before flipping to enforcement.
  // Only set Report-Only header (no enforcement) to surface violations without blocking.
  // After one release with no unexpected reports, remove Report-Only and uncomment
  // the enforcement header below.
  response.headers.set("Content-Security-Policy-Report-Only", cspHeaderValue);
  // TEMPORARY DISABLED: R-08 enforcement should be activated after one release cycle
  // with no unexpected CSP violation reports.
  // response.headers.set("Content-Security-Policy", cspHeaderValue);
  // Audit 7 Fix: Do not echo x-nonce in response headers to reduce exposure
  // response.headers.set("x-nonce", nonce);
  response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self)");
  response.headers.set("X-DNS-Prefetch-Control", "on");

  // Report-To header for CSP violation reporting (Reporting API v1)
  if (process.env.NODE_ENV !== "development") {
    response.headers.set(
      "Report-To",
      JSON.stringify({
        group: "csp-endpoint",
        max_age: 86400,
        endpoints: [{ url: CSP_REPORT_URI }],
      }),
    );
  }
}
