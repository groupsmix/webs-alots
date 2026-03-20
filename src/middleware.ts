import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Role to allowed route prefix mapping
const ROLE_ROUTE_MAP: Record<string, string> = {
  super_admin: "/super-admin",
  clinic_admin: "/admin",
  receptionist: "/receptionist",
  doctor: "/doctor",
  patient: "/patient",
  pharmacist: "/pharmacist",
};

// Role to dashboard path mapping
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  super_admin: "/super-admin/dashboard",
  clinic_admin: "/admin/dashboard",
  receptionist: "/receptionist/dashboard",
  doctor: "/doctor/dashboard",
  patient: "/patient/dashboard",
  pharmacist: "/pharmacist/dashboard",
};

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
  "/pharmacist",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
