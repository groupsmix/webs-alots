import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/subdomain";
import { TENANT_HEADERS } from "@/lib/tenant";
import { rateLimitRules } from "@/lib/rate-limit";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN;

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
    // Allow localhost origins in development
    if (process.env.NODE_ENV !== "production") {
      allowedOrigins.add(`${request.nextUrl.protocol}//${hostname}`);
    }

    if (!origin) {
      return NextResponse.json(
        { error: "CSRF validation failed: missing origin header" },
        { status: 403 },
      );
    }

    if (!allowedOrigins.has(origin)) {
      return NextResponse.json(
        { error: "CSRF validation failed: origin not allowed" },
        { status: 403 },
      );
    }
  }

  // --- Rate limiting for API mutations ---
  if (pathname.startsWith("/api/") && MUTATION_METHODS.has(request.method)) {
    const clientIp =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;

    if (!clientIp) {
      console.warn("[rate-limit] Could not determine client IP — applying strict limit");
    }

    // Use a shared "unknown" key for requests without a client IP so they
    // share a single rate-limit bucket instead of each getting its own
    // (which effectively bypasses rate limiting).
    const rateLimitKey = clientIp ?? "unknown-ip";

    const rule = rateLimitRules.find((r) => pathname.startsWith(r.prefix));
    if (rule && !rule.limiter.check(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
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
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

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
            request,
          });
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

  // If user is on a public route, allow through
  if (isPublicRoute(pathname)) {
    // If authenticated user visits login/register, redirect to their dashboard
    if (user && (pathname === "/login" || pathname === "/register")) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", user.id)
        .single();

      if (profile) {
        const dashboardPath =
          ROLE_DASHBOARD_MAP[profile.role] || "/patient/dashboard";
        return NextResponse.redirect(new URL(dashboardPath, request.url));
      }
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
  if (user && isProtectedRoute(pathname)) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (profile) {
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
