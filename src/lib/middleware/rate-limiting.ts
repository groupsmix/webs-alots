import { NextResponse, type NextRequest } from "next/server";
import { rateLimitRules, extractClientIp, globalPageLimiter } from "@/lib/rate-limit";
import type { CspHeaderValues } from "./security-headers";

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
  csp: CspHeaderValues,
  withSecurityHeaders: (r: NextResponse, csp: CspHeaderValues) => NextResponse,
): Promise<{ response: NextResponse | null; rateLimitInfo?: RateLimitInfo }> {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  // F-27: For authenticated AI/booking endpoints, prefer user ID over IP.
  // In edge middleware we don't have the decoded user yet, so we still
  // use IP here. Post-auth user-keyed limiting is done in route handlers
  // (withAuth) for /api/chat and /api/ai/* endpoints.
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
        csp,
      );
      response.headers.set("Retry-After", String(retryAfterSec));
      return {
        response,
        rateLimitInfo: { limit: rule.max, remaining: 0, reset },
      };
    }
  } else if (!pathname.startsWith("/_next/") && !pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?|ttf|eot)$/i)) {
    // A36.4: Apply a dedicated global rate limiter for non-API paths (HTML
    // pages, etc.) to prevent subdomain-enumeration DDoS attacks.
    // Previously this depended on a lookup against the /api/ catch-all rule
    // in rateLimitRules, which silently disappeared if that rule was absent.
    // The dedicated `globalPageLimiter` is now independent of API rules.
    const allowed = await globalPageLimiter.check(`global_${rateLimitKey}`);
    if (!allowed) {
      const response = withSecurityHeaders(
        NextResponse.json(
          { error: "Too many requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
          { status: 429 },
        ),
        csp,
      );
      response.headers.set("Retry-After", "60");
      return { response };
    }
  }

  return { response: null };
}
