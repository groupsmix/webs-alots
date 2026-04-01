/**
 * Route classification helpers for middleware.
 */

/** Routes that don't require authentication */
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
  "/pricing",
  "/how-to-book",
  "/location",
  "/testimonials",
  "/doctor-profile",
  "/doctor-services",
];

/** Public route prefixes (no auth required) */
const PUBLIC_PREFIXES = [
  "/pharmacy",
  "/dentist",
  "/lab",
];

/** Protected route prefixes (require authentication) */
const PROTECTED_PREFIXES = [
  "/patient",
  "/doctor",
  "/receptionist",
  "/admin",
  "/super-admin",
  "/pharmacist",
  "/nutritionist",
  "/optician",
  "/parapharmacy",
  "/physiotherapist",
  "/psychologist",
  "/radiology",
  "/speech-therapist",
  "/equipment",
  "/lab-panel",
];

/** Lightweight API routes that skip heavy middleware processing */
export const LIGHTWEIGHT_API_PATHS = new Set([
  "/api/health",
]);

/** Role to allowed route prefix mapping */
export const ROLE_ROUTE_MAP: Record<string, string> = {
  super_admin: "/super-admin",
  clinic_admin: "/admin",
  receptionist: "/receptionist",
  doctor: "/doctor",
  patient: "/patient",
};

/** Role to dashboard path mapping */
export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  super_admin: "/super-admin/dashboard",
  clinic_admin: "/admin/dashboard",
  receptionist: "/receptionist/dashboard",
  doctor: "/doctor/dashboard",
  patient: "/patient/dashboard",
};

/**
 * Determine whether a route is public (no middleware-level auth check).
 *
 * SECURITY NOTE — API routes and the "self-auth" pattern:
 * All `/api/` routes are classified as public here because API route handlers
 * are responsible for their own authentication (e.g., verifying session cookies,
 * Bearer tokens, or API keys). This is intentional:
 *
 *   - API routes may need unauthenticated access (booking, branding, health check).
 *   - Auth mechanisms vary per endpoint (cookie vs. Bearer vs. HMAC webhook sig).
 *   - Middleware-level auth would force a single auth strategy on all API routes.
 *
 * **Important for contributors:** If you add a new API route under `/api/`,
 * you MUST implement authentication in the route handler itself. There is no
 * middleware safety net — an API route without explicit auth checks will be
 * publicly accessible. Consider using `requireAuth()` or `requireRole()` helpers.
 *
 * Future improvement: consider inverting to a default-protected pattern with
 * an explicit allowlist for public API routes (e.g., `/api/book`, `/api/branding`,
 * `/api/health`) to reduce the risk of accidentally exposing new endpoints.
 */
export function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/api/") ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Get the dashboard path for a given role.
 */
export function getDashboardPath(role: string): string {
  return ROLE_DASHBOARD_MAP[role];
}
