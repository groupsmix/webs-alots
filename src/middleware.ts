/**
 * Next.js Middleware
 *
 * Composable modules:
 *   - @/lib/middleware/security-headers      — CSP, HSTS, nonce generation
 *   - @/lib/middleware/csrf                  — Origin-based CSRF validation
 *   - @/lib/middleware/rate-limiting         — Per-IP rate limiting for API routes
 *   - @/lib/middleware/routes                — Route classification helpers
 *   - @/lib/middleware/subdomain-resolution  — Subdomain → clinic cache + DB lookup
 *   - @/lib/middleware/mfa-enforcement       — MFA gating per role
 *
 * This file orchestrates the modules and handles Supabase auth.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getWorkerBinding } from "@/lib/cf-bindings";
import { verifyCronSecret } from "@/lib/cron-auth";
import { DEMO_SUBDOMAIN, shouldBlockDemoRequest } from "@/lib/demo";
import { isSupportedLocale } from "@/lib/i18n";
import { generateTraceId, TRACE_ID_HEADER } from "@/lib/logger";
import { applyCors } from "@/lib/middleware/cors";
import { validateCsrf } from "@/lib/middleware/csrf";
import { checkGeoRestriction } from "@/lib/middleware/geo-restriction";
import { enforceMfa } from "@/lib/middleware/mfa-enforcement";
import { applyRateLimit } from "@/lib/middleware/rate-limiting";
import {
  isPublicRoute,
  isProtectedRoute,
  LIGHTWEIGHT_API_PATHS,
  ROLE_ROUTE_MAP,
  ROLE_DASHBOARD_MAP,
} from "@/lib/middleware/routes";
import { checkSanctionedCountry } from "@/lib/middleware/sanctioned-countries";
import {
  buildCspHeaderValues,
  withSecurityHeaders,
  secureRedirect,
  applyAllSecurityHeaders,
} from "@/lib/middleware/security-headers";
import { resolveSubdomainClinic, type CachedClinic } from "@/lib/middleware/subdomain-resolution";
import { signProfileHeader, PROFILE_HEADER_NAMES } from "@/lib/profile-header-hmac";
import { isReservedSubdomain } from "@/lib/reserved-subdomains";
import { isSeedUserBlocked } from "@/lib/seed-guard";
import { extractRawSubdomain, extractSubdomain } from "@/lib/subdomain";
import { TENANT_HEADERS } from "@/lib/tenant";

/**
 * Set tenant headers on a response so downstream Server Components
 * and API routes can read them via getTenant().
 */
function setTenantHeaders(
  response: NextResponse,
  clinic: { id: string; name: string; subdomain: string; type: string; tier: string },
) {
  response.headers.set(TENANT_HEADERS.clinicId, clinic.id);
  response.headers.set(TENANT_HEADERS.clinicName, clinic.name);
  response.headers.set(TENANT_HEADERS.subdomain, clinic.subdomain);
  response.headers.set(TENANT_HEADERS.clinicType, clinic.type);
  response.headers.set(TENANT_HEADERS.clinicTier, clinic.tier);
}

/**
 * S0-1-03: Sanitize a post-login redirect path. Rejects protocol-relative
 * values (`//evil.example`) and anything that isn't a simple same-origin
 * path, preventing open-redirect attacks via the `?redirect=` query param.
 */
function safeRedirectPath(raw: string): string {
  // TF-02: Normalize the path first to defeat Unicode look-alike slashes
  // (e.g. U+2215 DIVISION SLASH, U+FF0F FULLWIDTH SOLIDUS) that bypass
  // the naive startsWith("//") check above.
  const normalized = decodeURIComponent(encodeURIComponent(raw)).normalize("NFKC");
  // Only allow paths that start with exactly one slash followed by a
  // non-slash character (or end of string for bare "/").
  if (!/^\/[^/]/.test(normalized) && normalized !== "/") return "/";
  return normalized;
}

/** Global body size cap (25 MB). Requests advertising a larger payload are
 *  rejected before any route handler runs, preventing memory exhaustion. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export async function middleware(request: NextRequest) {
  // AUDIT-25: Record middleware start time for CPU telemetry.
  // Cloudflare Workers CPU budget is set to 50ms in wrangler.toml (Paid plan).
  // This timing helps identify when middleware complexity approaches that
  // threshold so the team can optimize before p99 latency degrades.
  const mwStart = Date.now();

  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN;

  // --- A45.6: Global maintenance-mode kill-switch ---
  // Set MAINTENANCE_MODE=1 in env to immediately return 503 for all traffic
  // without redeploying the Worker. Health-check endpoint is exempted so
  // monitoring can detect when maintenance ends.
  if (process.env.MAINTENANCE_MODE === "1" && pathname !== "/api/health") {
    return new NextResponse("Service temporarily unavailable for maintenance", {
      status: 503,
      headers: {
        "Retry-After": "300",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Content-Type": "text/plain",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  }

  // --- Generate a per-request nonce for CSP ---
  // Hoisted before early-exit checks (sanctions, bot management) so all
  // rejection responses can carry the correct security headers.
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  // Task 2.2: Strict CSP is now enforced. Legacy broad policy removed.
  // TASK-009: Builder route gets a relaxed frame-src + script-src so the live
  // preview iframe (blob:) and Babel/Tailwind CDN scripts can load.
  // All other routes remain on the strict policy.
  const isBuilderRoute = pathname.startsWith("/super-admin/builder");
  const cspHeaders = buildCspHeaderValues(nonce, { isBuilderRoute });

  // --- F-A198 / F-A160: Sanctioned country block ---
  const sanctionBlock = checkSanctionedCountry(request);
  if (sanctionBlock) return sanctionBlock;

  // BOT-01: Cloudflare Bot Management score check on auth/API routes.
  // Score < 30 on a 0-100 scale indicates highly likely bot traffic.
  // Only enforced on Cloudflare Workers (score is undefined in local dev).
  // Note: routes live under the (auth) route-group which strips the prefix,
  // so the actual URL paths are /login and /register, not /auth/*.
  const AUTH_PATHS = ["/login", "/register", "/api/auth/"];
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
  if (isAuthPath && process.env.BOT_MANAGEMENT_ENABLED === "true") {
    // CF type: request.cf is available on Cloudflare Workers
    const botScore = (request as unknown as { cf?: { botManagement?: { score?: number } } }).cf
      ?.botManagement?.score;
    if (botScore !== undefined && botScore < 30) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Access denied" }, { status: 403 }),
        cspHeaders,
      );
    }
  }

  // --- WWW redirect (works on Cloudflare Workers unlike next.config redirects) ---
  const hostWithoutPort = hostname.split(":")[0];
  if (hostWithoutPort === `www.${rootDomain?.split(":")[0] ?? ""}`) {
    const url = request.nextUrl.clone();
    url.host = rootDomain ?? hostname.replace(/^www\./, "");
    return secureRedirect(url, 301);
  }

  // --- Generate a per-request trace ID for structured logging ---
  const traceId = generateTraceId();

  // --- Global body size limit ---
  // F-38: Check Content-Length header first (fast path), but also enforce
  // actual body size via stream reading in route handlers (see body-limit.ts).
  // Next.js middleware doesn't fully support stream-processing the body directly,
  // so this header check is the quick reject for honest clients and the per-route
  // stream check in route handlers is the robust defense against Content-Length
  // bypasses.
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Payload too large" }, { status: 413 }),
      cspHeaders,
    );
  }

  // --- Inject CSP nonce into request headers so Server Components
  //     can read it via headers().get('x-nonce') ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Forward the enforcing CSP so Server Components that introspect the request
  // headers see the same policy the browser will enforce. Guard against an
  // empty `enforce` value (e.g. a future report-only-only mode) so we never
  // forward a `Content-Security-Policy: ` header with a blank value — Server
  // Components that check for the header's presence would otherwise see an
  // empty string instead of either no header or the actual policy. This
  // mirrors the response-side guards in `withSecurityHeaders` and
  // `applyAllSecurityHeaders`.
  if (cspHeaders.enforce) {
    requestHeaders.set("Content-Security-Policy", cspHeaders.enforce);
  } else {
    requestHeaders.delete("Content-Security-Policy");
  }
  requestHeaders.set(TRACE_ID_HEADER, traceId);

  // --- SECURITY: Strip all tenant headers from the incoming request ---
  // Tenant context MUST only come from subdomain resolution (server-side).
  // Without this, an attacker could inject x-tenant-clinic-id (or any
  // x-tenant-* header) on a root-domain request and impersonate another
  // tenant on public endpoints like /api/booking and /api/branding.
  for (const key of Object.values(TENANT_HEADERS)) {
    requestHeaders.delete(key);
  }
  // RLS-05: Also strip the legacy x-clinic-id header used by tenant-scoped
  // Supabase clients (createTenantClient). An attacker could inject this
  // header to bypass RLS policies that read `request.headers->>'x-clinic-id'`.
  requestHeaders.delete("x-clinic-id");

  // --- i18n: honor an explicit ?lang override for the SSR locale + dir ---
  // The public marketing pages are edge-cached (Cache-Control: public,
  // s-maxage) and the cache key does NOT vary on cookie or Accept-Language, so
  // locale-by-cookie / locale-by-Accept-Language cannot be served reliably from
  // cache. A distinct URL is the only cache-safe selector — and `?lang=ar` is
  // exactly the Arabic URL our own hreflang tags advertise (hreflang-tags.tsx).
  // Honoring it here makes that crawlable URL actually render
  // `<html lang="ar" dir="rtl">` instead of falling back to French LTR.
  //
  // The choice is forwarded to Server Components via the `x-locale` request
  // header (mirrors x-tenant-locale). We strip any inbound x-locale first so a
  // client cannot forge it, then set only a validated, supported value.
  requestHeaders.delete("x-locale");
  const langParam = request.nextUrl.searchParams.get("lang");
  if (isSupportedLocale(langParam)) {
    requestHeaders.set("x-locale", langParam);
  }

  // Strip incoming x-auth-profile-* headers. These are set later in this
  // middleware (after the user/profile lookup) with an HMAC signature so
  // downstream API routes (`withAuth`) can trust them without re-querying
  // the DB. Allowing a client to forge them would let an attacker
  // impersonate any user, so we always overwrite with server-derived
  // values (or omit them entirely if no HMAC key is configured).
  for (const name of Object.values(PROFILE_HEADER_NAMES)) {
    requestHeaders.delete(name);
  }

  // --- Subdomain resolution ---
  const subdomain = extractSubdomain(hostname, rootDomain);

  // --- F-2 / SEC: Reserved-subdomain hard block ---
  // Reserved subdomains (api, admin, mail, auth, login, support, app, …) must
  // NEVER fall through to the marketing site. extractSubdomain() returns null
  // for them so they are not treated as tenants — but null *also* means "root
  // domain", and without this gate the request would continue and serve the
  // Oltigo homepage at e.g. admin.oltigo.com / paypal-verify-style infra hosts,
  // a ready-made phishing surface under our own brand. Detect the reserved host
  // explicitly via the RAW label and return the same hard 404 + noindex that an
  // unknown subdomain already gets (see A146-F2 below). Notes:
  //   • "www" is handled by its own redirect above and returns null from the
  //     raw extractor, so it is never caught here.
  //   • demo/test are OPERATIONAL_SUBDOMAINS (not reserved) and still resolve
  //     as tenants.
  //   • staging.* is served by a separate Worker (ROOT_DOMAIN=staging.oltigo.com,
  //     routes in wrangler.toml), so "staging" is its root — never a subdomain
  //     here — and is unaffected on the production Worker.
  const rawSubdomain = extractRawSubdomain(hostname, rootDomain);
  if (rawSubdomain && isReservedSubdomain(rawSubdomain)) {
    const reservedBlockResponse = withSecurityHeaders(
      new NextResponse("Not Found", { status: 404 }),
      cspHeaders,
    );
    reservedBlockResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
    reservedBlockResponse.headers.set("Cache-Control", "no-store");
    return reservedBlockResponse;
  }

  // --- Sec-07: CORS preflight handling ---
  const corsResult = applyCors(request, null);
  if (corsResult) return withSecurityHeaders(corsResult, cspHeaders);

  // --- CSRF protection (delegated to composable module) ---
  const csrfResult = validateCsrf(request, hostname, cspHeaders, withSecurityHeaders);
  if (csrfResult) return csrfResult;

  // --- A36.7: Geo-restriction for admin endpoints ---
  const geoResult = checkGeoRestriction(request);
  if (geoResult) return withSecurityHeaders(geoResult, cspHeaders);

  // --- Fast path for lightweight API routes (health checks, etc.) ---
  if (LIGHTWEIGHT_API_PATHS.has(pathname)) {
    const lightResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyAllSecurityHeaders(lightResponse, cspHeaders);
    return lightResponse;
  }

  // --- Rate limiting (delegated to composable module) ---
  const { response: rateLimitResponse, rateLimitInfo } = await applyRateLimit(
    request,
    cspHeaders,
    withSecurityHeaders,
  );
  if (rateLimitResponse) {
    // Add rate limit headers to the response
    if (rateLimitInfo) {
      rateLimitResponse.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
      rateLimitResponse.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
      rateLimitResponse.headers.set("X-RateLimit-Reset", rateLimitInfo.reset.toString());
    }
    return rateLimitResponse;
  }

  // Supabase configuration check.
  //
  // Production MUST fail closed: if NEXT_PUBLIC_SUPABASE_URL or
  // NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in a production runtime,
  // we have a misconfigured deploy that could partially serve the app
  // without auth (and therefore without tenant scoping / RLS). For a
  // healthcare platform handling PHI this must never silently degrade —
  // we return 503 so a failing health check trips deployment rollback
  // and operators are alerted, instead of leaking a half-functional UI.
  //
  // In non-production runtimes we keep the legacy demo-mode behavior:
  // public routes render with demo data and protected routes redirect
  // to /login. This preserves the local-dev experience without affecting
  // production safety.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      return withSecurityHeaders(
        new NextResponse("Server misconfigured", { status: 503 }),
        cspHeaders,
      );
    }

    // Non-production: allow demo-mode rendering.
    if (isProtectedRoute(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", safeRedirectPath(pathname));
      return secureRedirect(loginUrl);
    }
    const noSupabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyAllSecurityHeaders(noSupabaseResponse, cspHeaders);
    return noSupabaseResponse;
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applyAllSecurityHeaders(supabaseResponse, cspHeaders);

  // Set rate limit headers on every API response (not just 429) so
  // consumers can monitor their remaining quota proactively.
  if (rateLimitInfo && pathname.startsWith("/api/")) {
    supabaseResponse.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
    supabaseResponse.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
    supabaseResponse.headers.set("X-RateLimit-Reset", rateLimitInfo.reset.toString());
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        applyAllSecurityHeaders(supabaseResponse, cspHeaders);
        // Re-apply tenant headers so they survive token-refresh responses
        if (resolvedClinic) {
          setTenantHeaders(supabaseResponse, resolvedClinic);
        }
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // --- Resolve clinic from subdomain (delegated to composable module) ---
  // KV-01 / TASK-017: pass a KV binding so the resolver can use CF KV as
  // a second-tier cache before falling through to the Supabase DB.
  // Prefer TENANT_CACHE (TASK-017); fall back to SUBDOMAIN_KV (legacy).
  type KvBinding = Parameters<typeof resolveSubdomainClinic>[3];
  const subdomainKv =
    (await getWorkerBinding<KvBinding>("TENANT_CACHE")) ??
    (await getWorkerBinding<KvBinding>("SUBDOMAIN_KV"));
  let resolvedClinic: CachedClinic | undefined;
  if (subdomain) {
    const clinic = await resolveSubdomainClinic(
      subdomain,
      supabaseUrl,
      supabaseAnonKey,
      subdomainKv,
    );

    if (!clinic) {
      // A146-F2: Unknown subdomain — return a hard 404 with X-Robots-Tag
      // to prevent search engines from indexing attacker-chosen subdomains.
      // Previously this redirected to the root domain, but that could leak
      // SEO juice to wildcard subdomains via Cloudflare's wildcard proxy.
      const notFoundResponse = withSecurityHeaders(
        new NextResponse("Not Found", { status: 404 }),
        cspHeaders,
      );
      notFoundResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
      notFoundResponse.headers.set("Cache-Control", "no-store");
      return notFoundResponse;
    }

    resolvedClinic = clinic;

    // --- Demo tenant guard: block destructive API requests ---
    if (
      clinic.subdomain === DEMO_SUBDOMAIN &&
      shouldBlockDemoRequest(request.method, pathname, clinic.id)
    ) {
      return withSecurityHeaders(
        NextResponse.json(
          { ok: false, error: "Les modifications ne sont pas autorisées en mode démo." },
          { status: 403 },
        ),
        cspHeaders,
      );
    }

    // Attach tenant info to all responses so pages can read it
    setTenantHeaders(supabaseResponse, {
      id: clinic.id,
      name: clinic.name,
      subdomain: clinic.subdomain,
      type: clinic.type,
      tier: clinic.tier,
    });

    // AUDIT FINDING #2: Propagate the clinic's configured locale so that
    // layout.tsx, manifest.ts, and not-found.tsx render the correct
    // language and text direction (LTR/RTL) on first load. Maps the DB
    // column `patient_message_locale` ('fr'|'ar'|'darija') to the
    // x-tenant-locale header consumed by RSC. 'darija' is treated as 'ar'
    // for UI direction purposes (same script).
    const tenantLocale = clinic.patient_message_locale ?? "fr";
    requestHeaders.set("x-tenant-locale", tenantLocale);
  }

  // IMPORTANT: Do NOT use getSession() here — it reads from cookies and
  // can be tampered with. Use getUser() which validates with Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // SEED-01: Block seed users from accessing any route in production.
  // Sign them out and redirect to login with an error.
  if (user && isSeedUserBlocked(user.id)) {
    await supabase.auth.signOut();
    return secureRedirect(new URL("/login?error=account_disabled", request.url));
  }

  // Single profile query for authenticated users, reused for both
  // login-redirect and role-enforcement (avoids duplicate DB calls).
  let profile: { id: string; role: string; clinic_id: string | null } | null = null;
  if (user) {
    const needsProfile =
      (isPublicRoute(pathname) && (pathname === "/login" || pathname === "/register")) ||
      isProtectedRoute(pathname) ||
      pathname.startsWith("/api/");
    if (needsProfile) {
      const { data } = await supabase
        .from("users")
        .select("id, role, clinic_id")
        .eq("auth_id", user.id)
        .maybeSingle();
      profile = data;

      // Pass the profile data downstream via signed headers to avoid double-querying in `withAuth`.
      // R-01: When PROFILE_HEADER_HMAC_KEY (or CRON_SECRET as a transitional fallback) is
      //       unset, `signProfileHeader` returns null and we skip emitting the headers
      //       entirely. Downstream `withAuth` then performs the authoritative DB lookup —
      //       there is no literal fallback key that could be used to forge a signature.
      if (profile) {
        const signed = await signProfileHeader({
          id: profile.id,
          role: profile.role,
          clinic_id: profile.clinic_id,
        });

        if (signed) {
          // Set on the forwarded request headers so API routes (and `withAuth`)
          // can read them. These are stripped from the inbound request above so
          // a client cannot forge them.
          requestHeaders.set(PROFILE_HEADER_NAMES.id, profile.id);
          requestHeaders.set(PROFILE_HEADER_NAMES.role, profile.role);
          if (profile.clinic_id) {
            requestHeaders.set(PROFILE_HEADER_NAMES.clinic, profile.clinic_id);
          } else {
            requestHeaders.delete(PROFILE_HEADER_NAMES.clinic);
          }
          requestHeaders.set(PROFILE_HEADER_NAMES.sig, signed.sig);
          // C-02: Include the issued-at timestamp so withAuth can reject expired headers
          requestHeaders.set(PROFILE_HEADER_NAMES.iat, String(signed.iat));

          // Re-create the response so the new request headers are forwarded
          // downstream, but preserve any Set-Cookie headers (e.g. refreshed
          // Supabase auth tokens written by the `setAll` callback during
          // getUser()) and any tenant/security headers already on the
          // existing response. Recreating without copying these would silently
          // drop the refreshed session cookies and effectively log the user out.
          const previousResponse = supabaseResponse;
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          previousResponse.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") {
              supabaseResponse.headers.append(key, value);
            } else {
              supabaseResponse.headers.set(key, value);
            }
          });

          // Do NOT mirror the signed x-auth-profile-* headers onto the
          // outgoing response. They are an internal trust contract between
          // middleware and `withAuth` carried via the forwarded *request*
          // headers; emitting them on the response leaks the user id, role,
          // clinic id and HMAC signature to the browser and any
          // intermediaries. Re-apply security and tenant headers since the
          // response was just recreated.
          applyAllSecurityHeaders(supabaseResponse, cspHeaders);
          if (resolvedClinic) setTenantHeaders(supabaseResponse, resolvedClinic);
        }
      }
    }
  }

  // FP-02: Enforce cron auth at middleware level for /api/cron/ routes.
  // These routes are in PUBLIC_API_ROUTES (no session auth) but MUST carry
  // a valid CRON_SECRET bearer token. Previously only per-handler
  // verifyCronSecret guarded them — a missing guard in a new handler
  // would expose cron endpoints without auth.
  if (pathname.startsWith("/api/cron/")) {
    const cronDenied = verifyCronSecret(request);
    if (cronDenied) {
      return withSecurityHeaders(cronDenied, cspHeaders);
    }
    return supabaseResponse;
  }

  // If user is on a public route, allow through
  if (isPublicRoute(pathname)) {
    // If authenticated user visits login/register, redirect to their dashboard
    if (user && (pathname === "/login" || pathname === "/register") && profile) {
      const dashboardPath = ROLE_DASHBOARD_MAP[profile.role];
      if (dashboardPath) {
        return secureRedirect(new URL(dashboardPath, request.url));
      }
      // Unknown role with no dashboard — let them stay on login/register
    }
    return supabaseResponse;
  }

  // AUDIT-12 (P0-01): Deny-by-default for /api/ routes.
  // Any /api/* path not in the public allowlist must require an authenticated
  // session at the middleware layer. Without this explicit block, non-public
  // API routes would fall through the remaining checks (which only handle
  // PROTECTED_PREFIXES page routes) and reach `return supabaseResponse`
  // unauthenticated, making every newly-added API route publicly accessible
  // by default.
  if (pathname.startsWith("/api/") && !user) {
    return withSecurityHeaders(
      NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      ),
      cspHeaders,
    );
  }

  // If protected route and not authenticated, redirect to login
  if (isProtectedRoute(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", safeRedirectPath(pathname));
    return secureRedirect(loginUrl);
  }

  // If authenticated, check role-based access
  if (user && isProtectedRoute(pathname) && profile) {
    const allowedPrefix = ROLE_ROUTE_MAP[profile.role];

    // AUDIT-LB2: Fail-closed for unmapped roles. If a role is not in
    // ROLE_ROUTE_MAP, sign the user out and redirect to login. Without
    // the sign-out, the authenticated-user-on-login handler (below)
    // would bounce them to /patient/dashboard, creating an infinite
    // redirect loop.
    if (!allowedPrefix) {
      await supabase.auth.signOut();
      return secureRedirect(new URL("/login?error=unauthorized_role", request.url));
    }

    // MFA enforcement (delegated to composable module)
    const mfaRedirect = await enforceMfa(supabase, profile.role, pathname, request.url);
    if (mfaRedirect) return mfaRedirect;
    if (profile.role === "super_admin") return supabaseResponse;

    // Check if user is accessing their allowed routes
    if (!pathname.startsWith(allowedPrefix)) {
      const dashboardPath = ROLE_DASHBOARD_MAP[profile.role] || allowedPrefix;
      return secureRedirect(new URL(dashboardPath, request.url));
    }
  }

  // AUDIT-25: Log middleware execution time for CPU budget monitoring.
  // CPU budget is 50ms per request (wrangler.toml). Sustained p95 above
  // ~35ms should trigger investigation and optimization.
  const mwDuration = Date.now() - mwStart;
  if (mwDuration > 5) {
    // Only log slow requests to avoid noise. Threshold tuned for edge.
    supabaseResponse.headers.set("x-middleware-duration", String(mwDuration));
  }
  // Always set the header so downstream can correlate
  supabaseResponse.headers.set("server-timing", `mw;dur=${mwDuration}`);

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
