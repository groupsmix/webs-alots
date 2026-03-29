import { NextResponse, type NextRequest } from "next/server";

/** HTTP methods that mutate state and need CSRF protection */
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** API routes that receive legitimate external requests (webhooks, callbacks) */
const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks",
  "/api/payments/webhook",
  "/api/payments/cmi/callback",
  "/api/cron/reminders",
  "/api/cron/billing",
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
  cspHeaderValue: string,
  withSecurityHeaders: (r: NextResponse, csp: string) => NextResponse,
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
  const rootDomain = process.env.ROOT_DOMAIN;

  const allowedOrigins = new Set<string>();
  if (siteUrl) {
    allowedOrigins.add(siteUrl.replace(/\/$/, ""));
  }
  if (rootDomain) {
    const protocol = request.nextUrl.protocol;
    allowedOrigins.add(`${protocol}//${rootDomain}`);
  }
  if (origin && rootDomain) {
    try {
      const originHost = new URL(origin).hostname;
      const rootHost = rootDomain.split(":")[0];
      if (
        originHost.endsWith(`.${rootHost}`) &&
        !originHost.slice(0, -(rootHost.length + 1)).includes(".")
      ) {
        allowedOrigins.add(origin);
      }
    } catch (err) {
      /* malformed origin — log for debugging */
      void err;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add(`${request.nextUrl.protocol}//${hostname}`);
  }

  if (!origin) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "CSRF validation failed: missing origin header" },
        { status: 403 },
      ),
      cspHeaderValue,
    );
  }

  if (!allowedOrigins.has(origin)) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "CSRF validation failed: origin not allowed" },
        { status: 403 },
      ),
      cspHeaderValue,
    );
  }

  return null;
}
