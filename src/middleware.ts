/**
 * Next.js Middleware
 *
 * Refactored from a monolithic 557-line file into composable modules:
 *   - @/lib/middleware/security-headers — CSP, HSTS, nonce generation
 *   - @/lib/middleware/csrf             — Origin-based CSRF validation
 *   - @/lib/middleware/rate-limiting    — Per-IP rate limiting for API routes
 *   - @/lib/middleware/routes           — Route classification helpers
 *
 * This file orchestrates the modules and handles Supabase auth + subdomain resolution.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SUBDOMAIN, shouldBlockDemoRequest } from "@/lib/demo";
import { generateTraceId, TRACE_ID_HEADER } from "@/lib/logger";
import { validateCsrf } from "@/lib/middleware/csrf";
import { applyRateLimit } from "@/lib/middleware/rate-limiting";
import {
  isPublicRoute,
  isProtectedRoute,
  LIGHTWEIGHT_API_PATHS,
  ROLE_ROUTE_MAP,
  ROLE_DASHBOARD_MAP,
} from "@/lib/middleware/routes";
import {
  buildCspHeaderValues,
  withSecurityHeaders,
  secureRedirect,
  applyAllSecurityHeaders,
} from "@/lib/middleware/security-headers";
import { signProfileHeader, PROFILE_HEADER_NAMES } from "@/lib/profile-header-hmac";
import { isSeedUserBlocked } from "@/lib/seed-guard";
import { extractSubdomain } from "@/lib/subdomain";
import { subdomainCache, SUBDOMAIN_CACHE_TTL_MS, setSubdomainCache, negativeSubdomainCache, NEGATIVE_CACHE_TTL_MS, setNegativeSubdomainCache } from "@/lib/subdomain-cache";
import { TENANT_HEADERS } from "@/lib/tenant";

// ── Subdomain → clinic resolution cache ──────────────────────────
// Cache is now shared via @/lib/subdomain-cache so API routes can
// invalidate entries when a clinic's subdomain changes.
interface CachedClinic {
  id: string;
  name: string;
  subdomain: string;
  type: string;
  tier: string;
  cachedAt: number;
}

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

/** Global body size cap (25 MB). Requests advertising a larger payload are
 *  rejected before any route handler runs, preventing memory exhaustion. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN;

  // --- WWW redirect (works on Cloudflare Workers unlike next.config redirects) ---
  const hostWithoutPort = hostname.split(":")[0];
  if (hostWithoutPort === `www.${rootDomain?.split(":")[0] ?? ""}`) {
    const url = request.nextUrl.clone();
    url.host = rootDomain ?? hostname.replace(/^www\./, "");
    return secureRedirect(url, 301);
  }

  // --- Generate a per-request nonce for CSP ---
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  // Task 2.2: Strict CSP is now enforced. Legacy broad policy removed.
  const cspHeaders = buildCspHeaderValues(nonce);

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
      NextResponse.json(
        { error: "Payload too large" },
        { status: 413 },
      ),
      cspHeaders,
    );
  }

  // --- Inject CSP nonce into request headers so Server Components
  //     can read it via headers().get('x-nonce') ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Forward the enforcing CSP so Server Components that introspect the request
  // headers see the same policy the browser will enforce.
  requestHeaders.set("Content-Security-Policy", cspHeaders.enforce);
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

  // --- CSRF protection (delegated to composable module) ---
  const csrfResult = validateCsrf(request, hostname, cspHeaders, withSecurityHeaders);
  if (csrfResult) return csrfResult;

  // --- Fast path for lightweight API routes (health checks, etc.) ---
  if (LIGHTWEIGHT_API_PATHS.has(pathname)) {
    const lightResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyAllSecurityHeaders(lightResponse, cspHeaders, nonce);
    return lightResponse;
  }

  // --- Rate limiting (delegated to composable module) ---
  const { response: rateLimitResponse, rateLimitInfo } = await applyRateLimit(request, cspHeaders, withSecurityHeaders);
  if (rateLimitResponse) {
    // Add rate limit headers to the response
    if (rateLimitInfo) {
      rateLimitResponse.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
      rateLimitResponse.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
      rateLimitResponse.headers.set("X-RateLimit-Reset", rateLimitInfo.reset.toString());
    }
    return rateLimitResponse;
  }

  // If Supabase is not configured, allow all requests through
  // so the site renders with demo data instead of crashing
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // For protected routes without Supabase, redirect to login
    // (login page will show an appropriate message)
    if (isProtectedRoute(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return secureRedirect(loginUrl);
    }
    const noSupabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyAllSecurityHeaders(noSupabaseResponse, cspHeaders, nonce);
    return noSupabaseResponse;
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applyAllSecurityHeaders(supabaseResponse, cspHeaders, nonce);

  // Note: Real rate-limit state is enforced by the rate limiter above.
  // These placeholder headers are omitted to avoid misleading API consumers.

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          applyAllSecurityHeaders(supabaseResponse, cspHeaders, nonce);
          // Re-apply tenant headers so they survive token-refresh responses
          if (resolvedClinic) {
            setTenantHeaders(supabaseResponse, resolvedClinic);
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // --- Resolve clinic from subdomain (with in-memory cache) ---
  // Track resolved clinic so tenant headers can be re-applied if setAll
  // recreates supabaseResponse during token refresh.
  let resolvedClinic: CachedClinic | undefined;
  if (subdomain) {
    let clinic: CachedClinic | undefined;
    const cached = subdomainCache.get(subdomain);
    const negativeCached = negativeSubdomainCache.get(subdomain);

    if (cached && Date.now() - cached.cachedAt < SUBDOMAIN_CACHE_TTL_MS) {
      clinic = cached;
    } else if (negativeCached && Date.now() - negativeCached.cachedAt < NEGATIVE_CACHE_TTL_MS) {
      // Subdomain is known to be invalid — bypass Supabase entirely
      clinic = undefined;
    } else {
      // Use a separate anon-only Supabase client (no user session cookies)
      // for subdomain resolution. The RLS policy on `clinics` allows
      // unauthenticated reads (auth.uid() IS NULL) for active clinics,
      // but blocks authenticated users whose clinic_id doesn't match.
      // By omitting cookies, the query always runs as unauthenticated,
      // ensuring subdomain resolution works for all users.
      const anonSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() { return []; },
            setAll() { /* no-op */ },
          },
        }
      );

      const { data } = await anonSupabase
        .from("clinics")
        .select("id, name, type, tier, subdomain")
        .eq("subdomain", subdomain)
        .single();

      if (data) {
        clinic = { ...data, subdomain: data.subdomain ?? subdomain, cachedAt: Date.now() };
        setSubdomainCache(subdomain, clinic);
      } else {
        // Evict stale entry if the subdomain was previously valid
        subdomainCache.delete(subdomain);
        // Add to negative cache to prevent Supabase queries on random subdomains
        setNegativeSubdomainCache(subdomain);
      }
    }

    if (!clinic) {
      // Unknown subdomain → redirect to root domain
      const rootUrl = rootDomain
        ? `${request.nextUrl.protocol}//${rootDomain}`
        : request.nextUrl.origin;
      return secureRedirect(rootUrl);
    }

    resolvedClinic = clinic;

    // --- Demo tenant guard: block destructive API requests ---
    if (clinic.subdomain === DEMO_SUBDOMAIN && shouldBlockDemoRequest(request.method, pathname, clinic.id)) {
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
  let profile: { id: string, role: string, clinic_id: string | null } | null = null;
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
        const sigHex = await signProfileHeader({
          id: profile.id,
          role: profile.role,
          clinic_id: profile.clinic_id,
        });

        if (sigHex) {
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
          requestHeaders.set(PROFILE_HEADER_NAMES.sig, sigHex);

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
          applyAllSecurityHeaders(supabaseResponse, cspHeaders, nonce);
          if (resolvedClinic) setTenantHeaders(supabaseResponse, resolvedClinic);
        }
      }
    }
  }

  // If user is on a public route, allow through
  if (isPublicRoute(pathname)) {
    // If authenticated user visits login/register, redirect to their dashboard
    if (user && (pathname === "/login" || pathname === "/register") && profile) {
      const dashboardPath =
        ROLE_DASHBOARD_MAP[profile.role] || "/patient/dashboard";
      return secureRedirect(new URL(dashboardPath, request.url));
    }
    return supabaseResponse;
  }

  // If protected route and not authenticated, redirect to login
  if (isProtectedRoute(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return secureRedirect(loginUrl);
  }

  // If authenticated, check role-based access
  if (user && isProtectedRoute(pathname) && profile) {
    const allowedPrefix = ROLE_ROUTE_MAP[profile.role];

    // Super admin and doctor can access their routes, but MUST complete MFA if configured
    if (profile.role === "super_admin" || profile.role === "doctor") {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
        return secureRedirect(new URL("/login?mfa=required", request.url));
      }
      if (profile.role === "super_admin") return supabaseResponse;
    }

    // Enforce 2FA for clinic_admin role: if admin has MFA factors but
    // current session is only AAL1, redirect to the 2FA setup/verify page.
    // This ensures admins cannot access admin routes without completing MFA.
    if (profile.role === "clinic_admin" && pathname.startsWith("/admin")) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
        return secureRedirect(new URL("/login?mfa=required", request.url));
      }
    }

    // Check if user is accessing their allowed routes
    if (allowedPrefix && !pathname.startsWith(allowedPrefix)) {
      const dashboardPath =
        ROLE_DASHBOARD_MAP[profile.role] || "/patient/dashboard";
      return secureRedirect(new URL(dashboardPath, request.url));
    }
  }

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
