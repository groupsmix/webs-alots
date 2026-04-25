import { NextResponse } from "next/server";

/** OWASP-recommended HSTS max-age: 2 years (63 072 000 seconds). */
const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

/**
 * Build the Content-Security-Policy header value with a per-request nonce.
 */
/**
 * CSP reporting endpoint. In production, violations are sent to Sentry's
 * CSP reporting ingestion endpoint. The project ID and key should be
 * configured via the SENTRY_CSP_REPORT_URI environment variable.
 * Falls back to the app's own /api/csp-report endpoint for self-hosted
 * collection when Sentry is not configured.
 */
const CSP_REPORT_URI =
  process.env.SENTRY_CSP_REPORT_URI || "/api/csp-report";

export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // blob: is required for QR code download in qr-code-generator.tsx (Blob URL for SVG download).
    "img-src 'self' data: blob: *.supabase.co *.r2.cloudflarestorage.com *.r2.dev",
    // data: removed from font-src — Google Fonts via next/font are self-hosted and don't
    // need data: URIs. Removing data: prevents font-based CSS data exfiltration attacks.
    "font-src 'self'",
    "connect-src 'self' *.supabase.co wss://*.supabase.co *.googleapis.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
    "frame-src 'self'",
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
  response.headers.set("Content-Security-Policy", cspHeaderValue);
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
