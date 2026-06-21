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
    const allowed = await rule.limiter.check(rateLimitKey);
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
        rateLimitInfo: { limit: rule.max, remaining: 0, reset },
      };
    }

    rateLimitInfo = { limit: rule.max, remaining: Math.max(0, rule.max - 1), reset };
  } else if (
    !pathname.startsWith("/_next/") &&
    !pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?|ttf|eot)$/i)
  ) {
    // A36.4: Apply a dedicated global rate limiter for non-API paths (HTML
    // pages, etc.) to prevent subdomain-enumeration DDoS attacks.
    // Previously this depended on a lookup against the /api/ catch-all rule
    // in rateLimitRules, which silently disappeared if that rule was absent.
    // The dedicated `globalPageLimiter` is now independent of API rules.
    const allowed = await globalPageLimiter.check(`global_${rateLimitKey}`);
    if (!allowed) {
      // QA-B3-fix / I3: For HTML page navigations, return a human-readable HTML
      // 429 page instead of a raw JSON body. The page must be CSP-safe: the
      // strict middleware CSP blocks inline/`javascript:` scripts, so recovery
      // uses a `<meta http-equiv="refresh">` auto-retry (no JS) plus a plain
      // static link rather than a dead `javascript:history.back()` button.
      const retryAfterSec = 15;
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="refresh" content="${retryAfterSec}"/>
  <title>Trop de requêtes — Oltigo</title>
  <style>
    :root{color-scheme:light dark}
    body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#fafafa;
         color:#111827;display:flex;align-items:center;justify-content:center;min-height:100vh;
         margin:0;padding:1rem}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:.75rem;padding:2rem 2.5rem;
          max-width:440px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)}
    .icon{margin:0 auto 1rem;display:block}
    h1{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}
    p{color:#6b7280;font-size:.9rem;margin:.5rem 0;line-height:1.5}
    .hint{font-size:.8rem;color:#9ca3af;margin-top:1.25rem}
    a{display:inline-block;margin-top:1.25rem;background:#005a3b;color:#fff;text-decoration:none;
      padding:.55rem 1.4rem;border-radius:.5rem;font-size:.875rem}
    a:hover{background:#00472f}
  </style>
</head>
<body>
  <div class="card">
    <svg class="icon" width="40" height="40" viewBox="0 0 24 24" fill="none"
         stroke="#005a3b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         role="img" aria-label="Patientez">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
    <h1>Trop de requêtes</h1>
    <p>Vous avez effectué trop de requêtes en peu de temps.</p>
    <p>Cette page se rechargera automatiquement dans ${retryAfterSec} secondes.
    Vous pouvez aussi patienter quelques instants, puis réessayer.</p>
    <a href="/">Retour à l'accueil</a>
    <p class="hint">Si le problème persiste, ralentissez votre navigation
    ou contactez le support.</p>
  </div>
</body>
</html>`;
      const response = withSecurityHeaders(
        new NextResponse(html, {
          status: 429,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }),
        csp,
      );
      response.headers.set("Retry-After", String(retryAfterSec));
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
    const clinicAllowed = await perClinicLimiter.check(`clinic:${clinicKey}`);
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
