import { NextResponse } from "next/server";

/**
 * Build the Content-Security-Policy header value with a per-request nonce.
 */
export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: *.supabase.co *.r2.cloudflarestorage.com *.r2.dev",
    "font-src 'self' data:",
    "connect-src 'self' *.supabase.co wss://*.supabase.co graph.facebook.com api.twilio.com api.cloudflare.com *.googleapis.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
    "frame-src 'self' www.google.com",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
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
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

/**
 * Apply security headers to redirect responses.
 */
export function secureRedirect(url: string | URL, init?: number | ResponseInit): NextResponse {
  const response = NextResponse.redirect(url, init);
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
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
  nonce: string,
): void {
  response.headers.set("Content-Security-Policy", cspHeaderValue);
  response.headers.set("x-nonce", nonce);
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self)");
  response.headers.set("X-DNS-Prefetch-Control", "on");
}
