import { NextResponse, type NextRequest } from "next/server";
import {
  rateLimitRules,
  extractClientIp,
  globalPageLimiter,
  perClinicLimiter,
} from "@/lib/rate-limit";
import { subdomainCache, SUBDOMAIN_CACHE_TTL_MS } from "@/lib/subdomain-cache";
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
 * Always returns rateLimitInfo for API routes so standard headers
 * (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) can
 * be set on every response.
 */
export async function applyRateLimit(
  request: NextRequest,
  csp: CspHeaderValues,
  withSecurityHeaders: (r: NextResponse, csp: CspHeaderValues) => NextResponse,
): Promise<{ response: NextResponse | null; rateLimitInfo?: RateLimitInfo }> {
  // CI E2E bypass: Playwright tests run all requests from a single IP
  // (127.0.0.1) which easily exceeds per-IP limits. The CI environment
  // is not internet-facing so rate limiting provides no security value.
  // Gate on GITHUB_ACTIONS (not CI) per src/lib/env.ts convention —
  // CI=true is easy to set accidentally on a real deployment.
  // M-05: This bypass is intentional and accepted. E2E tests exercise the
  // application logic; rate-limiting is validated via unit tests in
  // src/lib/__tests__/rate-limit.test.ts.
  if (process.env.GITHUB_ACTIONS === "true") {
    return { response: null };
  }

  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  // F-27: For authenticated AI/booking endpoints, prefer user ID over IP.
  // In edge middleware we don't have the decoded user yet, so we still
  // use IP here. Post-auth user-keyed limiting is done in route handlers
  // (withAuth) for /api/chat and /api/ai/* endpoints.
  const rateLimitKey = `${hostname}:${extractClientIp(request)}`;

  // W8-RL-02: The `/api/` catch-all rule at the end of rateLimitRules is only
  // meant for mutations (POST/PUT/PATCH/DELETE), not GETs. Skip it for safe
  // methods so polling endpoints like /api/health don't trip the 30 req/min cap.
  const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  // Track rate limit info from the per-rule check so we can attach
  // X-RateLimit-* headers even on allowed (non-429) responses.
  let rateLimitInfo: RateLimitInfo | undefined;

  // Find a specific API rule if applicable
  const rule = rateLimitRules.find((r) => pathname.startsWith(r.prefix));
  const isCatchAll = rule?.prefix === "/api/";

  if (rule && !(isCatchAll && !MUTATION_METHODS.has(request.method))) {
    const checkResult = await rule.limiter.check(rateLimitKey);
    const allowed = typeof checkResult === "boolean" ? checkResult : checkResult.allowed;
    const remaining =
      typeof checkResult === "boolean" ? Math.max(0, rule.max - 1) : checkResult.remaining;

    const retryAfterSec = Math.ceil(rule.windowMs / 1000);
    const reset = Math.ceil(Date.now() / 1000) + retryAfterSec;

    if (!allowed) {
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
        rateLimitInfo: { limit: rule.max, remaining, reset },
      };
    }

    rateLimitInfo = { limit: rule.max, remaining, reset };
  } else if (
    !pathname.startsWith("/_next/") &&
    !pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?|ttf|eot)$/i)
  ) {
    // A36.4: Apply a dedicated global rate limiter for non-API paths (HTML
    // pages, etc.) to prevent subdomain-enumeration DDoS attacks.
    // Previously this depended on a lookup against the /api/ catch-all rule
    // in rateLimitRules, which silently disappeared if that rule was absent.
    // The dedicated `globalPageLimiter` is now independent of API rules.
    const globalCheck = await globalPageLimiter.check(`global_${rateLimitKey}`);
    const allowed = typeof globalCheck === "boolean" ? globalCheck : globalCheck.allowed;
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

  // A39-04: Per-clinic global rate cap.
  // W8-T-02/W8-RL-03: Key on clinic_id rather than hostname so custom-domain
  // aliases for the same clinic share a single counter. The subdomain cache is
  // populated by earlier middleware invocations and is a fast Map lookup.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/analytics") && hostname) {
    let clinicKey = hostname;
    const parts = hostname.split(".");
    const subdomain = parts.length >= 3 ? parts[0] : hostname;
    const cached = subdomainCache.get(subdomain);
    if (cached && Date.now() - cached.cachedAt <= SUBDOMAIN_CACHE_TTL_MS) {
      clinicKey = cached.id;
    }
    const clinicCheck = await perClinicLimiter.check(`clinic:${clinicKey}`);
    const clinicAllowed = typeof clinicCheck === "boolean" ? clinicCheck : clinicCheck.allowed;
    if (!clinicAllowed) {
      const response = withSecurityHeaders(
        NextResponse.json(
          {
            error: "Clinic rate limit exceeded. Please try again later.",
            code: "CLINIC_RATE_LIMIT_EXCEEDED",
          },
          { status: 429 },
        ),
        csp,
      );
      response.headers.set("Retry-After", "60");
      return { response };
    }
  }

  return { response: null, rateLimitInfo };
}
