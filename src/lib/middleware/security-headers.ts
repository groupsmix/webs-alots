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
 * Build the tightened Content-Security-Policy header value with a per-request
 * nonce. This is the target policy we want to eventually enforce.
 *
 * R-08: Wildcards (*.supabase.co, *.googleapis.com) replaced with the
 * project-specific Supabase hostname (derived from NEXT_PUBLIC_SUPABASE_URL)
 * and the exact Google endpoints the app uses.
 *
 * During the migration window this value is shipped as
 * Content-Security-Policy-Report-Only (via `applyAllSecurityHeaders`) so
 * violations are surfaced without breaking users. The enforcing header uses
 * the broader `buildLegacyCsp` policy to avoid regressions.
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
 * Build the legacy (broader) Content-Security-Policy used for enforcement
 * during the R-08 migration window.
 *
 * This matches the policy that was in production before R-08 tightened the
 * allow-lists, with one exception: it includes the `challenges.cloudflare.com`
 * entries added by R-10 so the Turnstile widget on the demo login page
 * continues to work under enforcement.
 *
 * Keeping enforcement on the legacy policy prevents regressions while the
 * new tighter policy is still being validated via Report-Only. Once one
 * release cycle has passed with no unexpected CSP violation reports, swap
 * enforcement to `buildCsp` and drop this helper.
 */
export function buildLegacyCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // F-25: 'strict-dynamic' + nonce; 'unsafe-inline' is ignored when a nonce
    // is present but required for legacy browser fallback.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https: http:${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // blob: is required for QR code download in qr-code-generator.tsx.
    "img-src 'self' data: blob: *.supabase.co uploads.oltigo.com",
    "font-src 'self'",
    // R-10: Turnstile widget needs to connect to challenges.cloudflare.com.
    "connect-src 'self' *.supabase.co wss://*.supabase.co *.googleapis.com https://cloudflareinsights.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
    // R-10: Turnstile widget is embedded via an iframe from Cloudflare.
    "frame-src 'self' https://challenges.cloudflare.com",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ...(isDev ? [] : [`report-uri ${CSP_REPORT_URI}`]),
    ...(isDev ? [] : ["report-to csp-endpoint"]),
  ].join("; ");
}

/**
 * Pair of CSP values used by the response-header helpers: the enforcing
 * policy (broader, for backwards compatibility) and the tighter Report-Only
 * policy that surfaces violations for the upcoming flip to enforcement.
 */
export interface CspHeaderValues {
  /** Value for the enforcing `Content-Security-Policy` header. */
  enforce: string;
  /** Value for the `Content-Security-Policy-Report-Only` header. */
  reportOnly: string;
}

/**
 * Convenience helper that builds both the enforcing (legacy/broad) and
 * Report-Only (new/tight) CSP values for a given nonce.
 */
export function buildCspHeaderValues(nonce: string): CspHeaderValues {
  return {
    enforce: buildLegacyCsp(nonce),
    reportOnly: buildCsp(nonce),
  };
}

/**
 * Apply defense-in-depth security headers to early-return error responses.
 *
 * Sets both the enforcing CSP (legacy/broad) and the Report-Only CSP
 * (new/tight) so error responses behave the same as normal responses during
 * the R-08 migration window.
 */
export function withSecurityHeaders(
  response: NextResponse,
  csp: CspHeaderValues,
): NextResponse {
  response.headers.set("Content-Security-Policy", csp.enforce);
  response.headers.set("Content-Security-Policy-Report-Only", csp.reportOnly);
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
 *
 * R-08 migration: Enforce the legacy (broad) CSP while shipping the new
 * tighter policy as Report-Only. This preserves existing protection (no
 * regression from commenting out enforcement entirely) while surfacing
 * violations of the target policy so they can be fixed before we flip the
 * enforcement header to the tight policy.
 */
export function applyAllSecurityHeaders(
  response: NextResponse,
  csp: CspHeaderValues,
  _nonce: string, // Unused but kept for API compatibility
): void {
  response.headers.set("Content-Security-Policy", csp.enforce);
  response.headers.set("Content-Security-Policy-Report-Only", csp.reportOnly);
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
