/**
 * Sec-07: CORS middleware layer.
 *
 * Enforces a strict Origin allowlist for cross-origin API requests.
 * Only the apex domain and wildcard tenant subdomains are permitted.
 * Webhook endpoints are excluded (they use provider-specific signature
 * verification, not CORS).
 *
 * Default behavior: no Access-Control-Allow-Origin header is set for
 * requests that don't match the allowlist, which causes the browser to
 * block the response. This is the safest default for a healthcare platform.
 */

import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths that should NOT receive CORS headers. These are server-to-server
 * endpoints authenticated via provider-specific mechanisms (HMAC, Bearer).
 */
const CORS_EXEMPT_PREFIXES = ["/api/webhooks", "/api/cron/", "/api/payments/webhook"];

/**
 * Check whether a request origin is allowed under the CORS policy.
 *
 * Allowed origins:
 *   - https://oltigo.com (apex)
 *   - https://*.oltigo.com (any tenant subdomain)
 *   - http://localhost:* (development only)
 */
function isAllowedOrigin(origin: string, rootDomain: string | undefined): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);

    // Development: allow localhost
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return process.env.NODE_ENV !== "production";
    }

    const domain = rootDomain || "oltigo.com";

    // Apex domain
    if (url.hostname === domain) return true;

    // Tenant subdomains (*.oltigo.com)
    if (url.hostname.endsWith(`.${domain}`)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Apply CORS headers to a response if the request is a valid cross-origin
 * API request. Returns a preflight response for OPTIONS requests.
 *
 * @returns A preflight response for OPTIONS, or null (caller should continue).
 */
export function applyCors(
  request: NextRequest,
  response: NextResponse | null,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Skip CORS for non-API routes and exempt paths
  if (!pathname.startsWith("/api/")) return null;
  if (CORS_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const rootDomain = process.env.ROOT_DOMAIN;
  if (!isAllowedOrigin(origin, rootDomain)) return null;

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // For actual requests, apply CORS headers to the passed response (if any)
  // Caller is responsible for applying headers to the final response if null
  if (response) {
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return null;
}
