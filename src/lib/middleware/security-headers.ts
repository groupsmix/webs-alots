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
 * Derive the Plausible analytics host so the CSP allows beacon requests.
 * Falls back to the Plausible Cloud default when not configured.
 */
function getPlausibleHost(): string | null {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  const host = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";
  try {
    return new URL(host).hostname;
  } catch {
    return "plausible.io";
  }
}

export interface BuildCspOptions {
  /**
   * When true, indicates the policy is intended for the Report-Only header.
   * The directives are identical either way; this flag is used by callers
   * to decide which HTTP header to set.
   * @default false
   */
  reportOnly?: boolean;
}

/**
 * Build the strict Content-Security-Policy header value with a per-request
 * nonce.
 *
 * R-08: Wildcards (*.supabase.co, *.googleapis.com) replaced with the
 * project-specific Supabase hostname (derived from NEXT_PUBLIC_SUPABASE_URL)
 * and the exact Google endpoints the app uses.
 *
 * Task 2.2: This policy is now **enforced** (no longer report-only).
 * The legacy broad CSP has been removed.
 */
export function buildCsp(nonce: string, _options?: BuildCspOptions): string {
  const isDev = process.env.NODE_ENV === "development";
  const sbHost = getSupabaseHost();
  const plausibleHost = getPlausibleHost();

  const connectSources = [
    "'self'",
    sbHost,
    `wss://${sbHost}`,
    "https://fonts.googleapis.com",
    "https://maps.googleapis.com",
    "https://www.googleapis.com/calendar",
    "https://cloudflareinsights.com",
    "https://static.cloudflareinsights.com",
    "https://challenges.cloudflare.com",
    ...(plausibleHost ? [`https://${plausibleHost}`] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https: http:${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: ${sbHost} uploads.oltigo.com`,
    "font-src 'self'",
    `connect-src ${connectSources}`,
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
 * @deprecated The legacy broad CSP has been removed (Task 2.2).
 * Use `buildCsp` directly — it is now the enforced policy.
 *
 * This stub remains temporarily for backward compatibility with any
 * call-sites that haven't been updated yet. It delegates to buildCsp.
 */
export function buildLegacyCsp(nonce: string): string {
  return buildCsp(nonce, { reportOnly: false });
}

/**
 * CSP values used by the response-header helpers.
 *
 * Task 2.2: The strict policy is now the enforced policy.
 * `reportOnly` is kept as an empty string — the Report-Only header is
 * no longer emitted.
 */
export interface CspHeaderValues {
  /** Value for the enforcing `Content-Security-Policy` header. */
  enforce: string;
  /**
   * @deprecated No longer used. The Report-Only header has been removed.
   * Kept for interface compatibility; always empty string.
   */
  reportOnly: string;
}

/**
 * Build the CSP header values. The strict policy is now enforced directly.
 */
export function buildCspHeaderValues(nonce: string): CspHeaderValues {
  return {
    enforce: buildCsp(nonce, { reportOnly: false }),
    reportOnly: "",
  };
}

/**
 * Apply defense-in-depth security headers to early-return error responses.
 *
 * Task 2.2: Enforces the strict CSP. The Report-Only header is removed.
 */
export function withSecurityHeaders(
  response: NextResponse,
  csp: CspHeaderValues,
): NextResponse {
  response.headers.set("Content-Security-Policy", csp.enforce);
  response.headers.delete("Content-Security-Policy-Report-Only");
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
 * Task 2.2: The strict CSP is now the enforced policy. The legacy broad CSP
 * and Report-Only header have been removed.
 */
export function applyAllSecurityHeaders(
  response: NextResponse,
  csp: CspHeaderValues,
  _nonce: string, // Unused but kept for API compatibility
): void {
  response.headers.set("Content-Security-Policy", csp.enforce);
  response.headers.delete("Content-Security-Policy-Report-Only");
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
