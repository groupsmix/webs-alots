import { NextResponse, type NextRequest } from "next/server";
import { rateLimitRules, extractClientIp } from "@/lib/rate-limit";

/**
 * Rate limit info to be added to response headers
 */
export interface RateLimitInfo {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the rate limit resets */
  reset: number;
}

/**
 * Apply rate limiting for API requests.
 * Returns a 429 NextResponse if rate limit exceeded, or null if OK.
 * Also returns rate limit info that can be added to response headers.
 */
export async function applyRateLimit(
  request: NextRequest,
  cspHeaderValue: string,
  withSecurityHeaders: (r: NextResponse, csp: string) => NextResponse,
): Promise<{ response: NextResponse | null; rateLimitInfo?: RateLimitInfo }> {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const rateLimitKey = `${hostname}:${extractClientIp(request)}`;

  // Find a specific API rule if applicable
  const rule = rateLimitRules.find((r) => pathname.startsWith(r.prefix));

  if (rule) {
    const allowed = await rule.limiter.check(rateLimitKey);
    if (!allowed) {
      const retryAfterSec = Math.ceil(rule.windowMs / 1000);
      const reset = Math.ceil(Date.now() / 1000) + retryAfterSec;
      const response = withSecurityHeaders(
        NextResponse.json(
          { error: "Too many requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
          { status: 429 },
        ),
        cspHeaderValue,
      );
      response.headers.set("Retry-After", String(retryAfterSec));
      return {
        response,
        rateLimitInfo: { limit: rule.max, remaining: 0, reset },
      };
    }
  } else if (!pathname.startsWith("/_next/") && !pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?|ttf|eot)$/i)) {
    // Audit 3: Apply a global rate limit to non-API paths (HTML pages, etc.)
    // to prevent subdomain enumeration DDoS attacks.
    // Allow 100 requests per minute per IP per Host
    const globalLimiter = rateLimitRules.find(r => r.prefix === "/api")?.limiter;
    if (globalLimiter) {
      const allowed = await globalLimiter.check(`global_${rateLimitKey}`);
      if (!allowed) {
        const response = withSecurityHeaders(
          NextResponse.json(
            { error: "Too many requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
            { status: 429 },
          ),
          cspHeaderValue,
        );
        response.headers.set("Retry-After", "60");
        return { response };
      }
    }
  }

  return { response: null };
}
