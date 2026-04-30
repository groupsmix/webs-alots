import { NextResponse, type NextRequest } from "next/server";
import type { CspHeaderValues } from "./security-headers";

/** HTTP methods that mutate state and need CSRF protection */
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** API routes that receive legitimate external requests (webhooks, callbacks, cron)
 *  or browser-initiated requests that don't carry a matching Origin header. */
const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks",
  "/api/payments/webhook",
  "/api/payments/cmi/callback",
  // CSRF-01: All cron endpoints are authenticated via CRON_SECRET bearer token
  // and may be triggered by external schedulers (Cloudflare Cron Triggers).
  "/api/cron/",
  // CSP-RPT: Browsers send Content-Security-Policy violation reports as POST
  // requests with a `report-uri` or `report-to` directive. The Origin header
  // may not match the site URL (some browsers use `null` or omit it entirely),
  // so the endpoint must be CSRF-exempt. The payload is a fixed JSON schema
  // that the handler validates — no state mutation occurs.
  "/api/csp-report",
];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Validate CSRF protection for mutation API requests.
 * Returns a 403 NextResponse if validation fails, or null if OK.
 */
export function validateCsrf(
  request: NextRequest,
  hostname: string,
  csp: CspHeaderValues,
  withSecurityHeaders: (r: NextResponse, csp: CspHeaderValues) => NextResponse,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (
    !pathname.startsWith("/api/") ||
    !MUTATION_METHODS.has(request.method) ||
    isCsrfExempt(pathname)
  ) {
    return null;
  }

  const origin = request.headers.get("origin");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  // Audit P1 #9: Lock the Origin allow-list to the specific request's host
  // rather than blindly trusting every *.oltigo.com peer. This prevents
  // cross-tenant CSRF where tenant A issues a request to tenant B.
  const allowedOrigins = new Set<string>();
  allowedOrigins.add(`${request.nextUrl.protocol}//${hostname}`);
  if (siteUrl) {
    allowedOrigins.add(siteUrl.replace(/\/$/, ""));
  }

  // CSRF-DESIGN: We intentionally reject requests with a missing Origin header.
  // Some legitimate scenarios omit the Origin header (same-origin navigational
  // POSTs in certain browsers, privacy extensions that strip it, or server-to-server
  // calls). However, accepting missing-Origin requests would weaken CSRF protection
  // significantly — an attacker could strip the header to bypass the check.
  //
  // Mitigations for legitimate consumers:
  //   - Webhook/cron paths are already exempt (see CSRF_EXEMPT_PREFIXES above).
  //   - Server-to-server callers should use Bearer token auth, not cookie-based
  //     sessions, and hit exempt endpoints or use a dedicated API key route.
  //   - Same-origin fetch() calls in modern browsers always include the Origin
  //     header for mutation methods when using the default "cors" or "same-origin"
  //     mode.
  //
  // If a legitimate API consumer receives a 403 here, ensure the request includes
  // the Origin header (e.g., use `fetch(url, { method: 'POST' })` which sends it
  // automatically) or add the route to CSRF_EXEMPT_PREFIXES with appropriate
  // alternative authentication (e.g., Bearer token, API key, HMAC signature).
  if (!origin) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "CSRF validation failed: missing origin header" },
        { status: 403 },
      ),
      csp,
    );
  }

  if (!allowedOrigins.has(origin)) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "CSRF validation failed: origin not allowed" },
        { status: 403 },
      ),
      csp,
    );
  }

  return null;
}
