import { NextResponse, type NextRequest } from "next/server";
import { rateLimitRules, extractClientIp } from "@/lib/rate-limit";

/**
 * Apply rate limiting for API requests.
 * Returns a 429 NextResponse if rate limit exceeded, or null if OK.
 */
export async function applyRateLimit(
  request: NextRequest,
  cspHeaderValue: string,
  withSecurityHeaders: (r: NextResponse, csp: string) => NextResponse,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) return null;

  const rateLimitKey = extractClientIp(request);
  const rule = rateLimitRules.find((r) => pathname.startsWith(r.prefix));

  if (rule) {
    const allowed = await rule.limiter.check(rateLimitKey);
    if (!allowed) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 },
        ),
        cspHeaderValue,
      );
    }
  }

  return null;
}
