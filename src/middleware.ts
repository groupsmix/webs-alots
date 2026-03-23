import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/subdomain";
import { TENANT_HEADERS } from "@/lib/tenant";
import { rateLimitRules, extractClientIp } from "@/lib/rate-limit";

// Role to allowed route prefix mapping
const ROLE_ROUTE_MAP: Record<string, string> = {
  super_admin: "/super-admin",
  clinic_admin: "/admin",
  receptionist: "/receptionist",
  doctor: "/doctor",
  patient: "/patient",
};

// Role to dashboard path mapping
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  super_admin: "/super-admin/dashboard",
  clinic_admin: "/admin/dashboard",
  receptionist: "/receptionist/dashboard",
  doctor: "/doctor/dashboard",
  patient: "/patient/dashboard",
};

// HTTP methods that mutate state and need CSRF protection
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// API routes that receive legitimate external requests (webhooks, callbacks)
// and must be exempt from Origin checks.
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

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/services",
  "/contact",
  "/blog",
  "/book",
  "/reviews",
  "/login",
  "/register",
  "/auth/callback",
  "/how-to-book",
  "/location",
];

// Public route prefixes (no auth required)
const PUBLIC_PREFIXES = [
  "/pharmacy",
];

// Protected route prefixes (require authentication)
const PROTECTED_PREFIXES = [
  "/patient",
  "/doctor",
  "/receptionist",
  "/admin",
  "/super-admin",
];

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/api/") ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

/**
 * Apply defense-in-depth security headers to early-return error responses
 * (CSRF rejection, rate limiting, payload-too-large) that bypass the normal
 * response flow where headers are set on the forwarded `supabaseResponse`.
 */
function withSecurityHeaders(
  response: NextResponse,
  cspHeaderValue: string,
): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeaderValue);
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

/**
 * Build the Content-Security-Policy header value with a per-request nonce
 * for script-src (replaces 'unsafe-inline').
 *
 * ACCEPTED RISK: style-src retains 'unsafe-inline' because Tailwind CSS
 * and shadcn/ui inject inline styles that cannot be nonce-gated without
 * significant architectural changes (CSS-in-JS or build-time extraction).
 *
 * ACCEPTED RISK: img-src allows 'data:' and 'blob:' for avatar placeholders,
 * dynamic chart rendering (recharts), and QR code generation. User-uploaded
 * images are served from R2/Supabase with Content-Disposition: attachment.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Styles: self + inline (Tailwind, shadcn) — see ACCEPTED RISK above
    "style-src 'self' 'unsafe-inline'",
    // Images: self + R2 storage + Supabase storage + data URIs + blobs
    "img-src 'self' data: blob: *.supabase.co *.r2.cloudflarestorage.com *.r2.dev",
    // Fonts: self + common CDNs
    "font-src 'self' data:",
    // API connections: self + Supabase + WhatsApp + Cloudflare + Google
    "connect-src 'self' *.supabase.co wss://*.supabase.co graph.facebook.com api.twilio.com api.cloudflare.com *.googleapis.com",
    // Frames: Google Maps embeds only
    "frame-src 'self' www.google.com",
    // Form actions: self only
    "form-action 'self'",
    // Base URI: self only
    "base-uri 'self'",
    // Upgrade HTTP to HTTPS automatically
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN;

  // --- Generate a per-request nonce for CSP ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeaderValue = buildCsp(nonce);

  // --- Global body size limit ---
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Payload too large" },
        { status: 413 },
      ),
      cspHeaderValue,
    );
  }

  // --- Inject CSP nonce into request headers so Server Components
  //     can read it via headers().get('x-nonce') ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  // --- Subdomain resolution ---
  const subdomain = extractSubdomain(hostname, rootDomain);

  // --- CSRF protection for mutation requests to API routes ---
  // Verify that the Origin header matches our known host to prevent
  // cross-site request forgery on cookie-authenticated endpoints.
  if (
    pathname.startsWith("/api/") &&
    MUTATION_METHODS.has(request.method) &&
    !isCsrfExempt(pathname)
  ) {
    const origin = request.headers.get("origin");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    // Build set of allowed origins from configured values only.
    // IMPORTANT: Do NOT trust the Host header — it is attacker-controlled
    // and would allow an attacker to set Host to match their Origin,
    // bypassing the CSRF check entirely.
    const allowedOrigins = new Set<string>();
    // Allow configured site URL (production domain)
    if (siteUrl) {
      allowedOrigins.add(siteUrl.replace(/\/$/, ""));
    }
    // Allow root domain if configured
    if (rootDomain) {
      const protocol = request.nextUrl.protocol;
      allowedOrigins.add(`${protocol}//${rootDomain}`);
    }
    // Allow valid subdomain origins (e.g. clinic1.example.com)
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
      } catch {
        /* malformed origin — will be rejected below */
      }
    }
    // Allow localhost origins in development
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
  }

  // --- Rate limiting for API requests ---
  // S1: Apply rate limiting to ALL HTTP methods (not just mutations).
  // GET endpoints like /api/v1/*, /api/chat, /api/health can be abused
  // for data scraping or resource exhaustion.
  if (pathname.startsWith("/api/")) {
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
      return NextResponse.redirect(loginUrl);
    }
    const noSupabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    noSupabaseResponse.headers.set("Content-Security-Policy", cspHeaderValue);
    noSupabaseResponse.headers.set("x-nonce", nonce);
    noSupabaseResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    return noSupabaseResponse;
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  supabaseResponse.headers.set("Content-Security-Policy", cspHeaderValue);
  supabaseResponse.headers.set("x-nonce", nonce);
  supabaseResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

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
          supabaseResponse.headers.set("Content-Security-Policy", cspHeaderValue);
          supabaseResponse.headers.set("x-nonce", nonce);
          supabaseResponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // --- Resolve clinic from subdomain ---
  if (subdomain) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, type, tier, subdomain")
      .eq("subdomain", subdomain)
      .single();

    if (!clinic) {
      // Unknown subdomain → redirect to root domain
      const rootUrl = rootDomain
        ? `${request.nextUrl.protocol}//${rootDomain}`
        : request.nextUrl.origin;
      return NextResponse.redirect(rootUrl);
    }

    // Attach tenant info to all responses so pages can read it
    setTenantHeaders(supabaseResponse, {
      id: clinic.id,
      name: clinic.name,
      subdomain: clinic.subdomain ?? subdomain,
      type: clinic.type,
      tier: clinic.tier,
    });
  }

  // IMPORTANT: Do NOT use getSession() here — it reads from cookies and
  // can be tampered with. Use getUser() which validates with Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Single profile query for authenticated users, reused for both
  // login-redirect and role-enforcement (avoids duplicate DB calls).
  let profile: { role: string } | null = null;
  if (user) {
    const needsProfile =
      (isPublicRoute(pathname) && (pathname === "/login" || pathname === "/register")) ||
      isProtectedRoute(pathname);
    if (needsProfile) {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", user.id)
        .maybeSingle();
      profile = data;
    }
  }

  // If user is on a public route, allow through
  if (isPublicRoute(pathname)) {
    // If authenticated user visits login/register, redirect to their dashboard
    if (user && (pathname === "/login" || pathname === "/register") && profile) {
      const dashboardPath =
        ROLE_DASHBOARD_MAP[profile.role] || "/patient/dashboard";
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
    return supabaseResponse;
  }

  // If protected route and not authenticated, redirect to login
  if (isProtectedRoute(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated, check role-based access
  if (user && isProtectedRoute(pathname) && profile) {
    const allowedPrefix = ROLE_ROUTE_MAP[profile.role];

    // Super admin can access everything
    if (profile.role === "super_admin") {
      return supabaseResponse;
    }

    // Check if user is accessing their allowed routes
    if (allowedPrefix && !pathname.startsWith(allowedPrefix)) {
      const dashboardPath =
        ROLE_DASHBOARD_MAP[profile.role] || "/patient/dashboard";
      return NextResponse.redirect(new URL(dashboardPath, request.url));
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
