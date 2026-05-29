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
const PUBLIC_PREFIXES = ["/pharmacy", "/dentist", "/lab/"];

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
export const LIGHTWEIGHT_API_PATHS = new Set(["/api/health", "/api/v1/health"]);

/**
 * Role to allowed route prefix mapping.
 *
 * AUDIT-LB2: Every role that has a PROTECTED_PREFIXES entry MUST appear
 * here. If a role is missing, the middleware check fails open and the
 * user bypasses route scoping. Unknown roles are denied in middleware
 * (see fail-closed block in middleware.ts).
 */
export const ROLE_ROUTE_MAP: Record<string, string> = {
  super_admin: "/super-admin",
  clinic_admin: "/admin",
  receptionist: "/receptionist",
  doctor: "/doctor",
  patient: "/patient",
  pharmacist: "/pharmacist",
  nutritionist: "/nutritionist",
  optician: "/optician",
  parapharmacy: "/parapharmacy",
  physiotherapist: "/physiotherapist",
  psychologist: "/psychologist",
  radiology: "/radiology",
  speech_therapist: "/speech-therapist",
  equipment: "/equipment",
  lab: "/lab-panel",
};

/** Role to dashboard path mapping */
export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  super_admin: "/super-admin/dashboard",
  clinic_admin: "/admin/dashboard",
  receptionist: "/receptionist/dashboard",
  doctor: "/doctor/dashboard",
  patient: "/patient/dashboard",
  pharmacist: "/pharmacist/dashboard",
  nutritionist: "/nutritionist/dashboard",
  optician: "/optician/dashboard",
  parapharmacy: "/parapharmacy/dashboard",
  physiotherapist: "/physiotherapist/dashboard",
  psychologist: "/psychologist/dashboard",
  radiology: "/radiology/dashboard",
  speech_therapist: "/speech-therapist/dashboard",
  equipment: "/equipment/dashboard",
  lab: "/lab-panel/dashboard",
};

/**
 * API routes that are intentionally public (no middleware-level auth).
 *
 * AUDIT-12 (P0-01): Previously ALL `/api/` routes were public by default,
 * relying on each handler to implement its own auth. This created a risk
 * where a new API route without explicit auth checks would be publicly
 * accessible. Now API routes are **protected by default** unless they
 * appear in this allowlist.
 *
 * To add a new public API route, add it here and document why it must
 * be unauthenticated (e.g. webhook with HMAC signature, public booking
 * flow, health check).
 */
const PUBLIC_API_ROUTES = [
  // Health checks — must be unauthenticated for uptime monitoring
  "/api/health",
  "/api/health/internal",
  // Public booking flow — anonymous patients book appointments
  "/api/booking",
  "/api/booking/verify",
  "/api/booking/cancel",
  // Public branding — needed to render clinic's branded booking page
  "/api/branding",
  // Webhooks — authenticated via provider signatures (Stripe, WhatsApp, etc.)
  "/api/webhooks",
  "/api/payments/webhook",
  "/api/payments/cmi/callback",
  // Cron jobs — authenticated via CRON_SECRET bearer token
  "/api/cron/",
  // Public email verification
  "/api/verify-email",
  // API docs
  "/api/docs",
  // Check-in kiosk — public-facing
  "/api/checkin/lookup",
  "/api/checkin/confirm",
  "/api/checkin/status",
  // Public clinic registration
  "/api/v1/register-clinic",
  // Public REST API — authenticated via Bearer API key, not session cookies
  "/api/v1/patients",
  "/api/v1/appointments",
  // Stripe billing webhook — authenticated via stripe-signature HMAC
  "/api/billing/webhook",
  // QR scan check-in — patients scan QR at clinic entrance without session
  "/api/checkin/qr-scan",
  // NPS survey response — patients submit via WhatsApp link without session
  "/api/nps/respond",
  // Waiting queue — public display on waiting room screens
  "/api/waiting-queue",
  // Public chatbot — basic (keyword) tier serves anonymous clinic visitors
  "/api/chat",
  // Demo login (dev/staging only, guarded in handler)
  "/api/auth/demo-login",
  // CSP report endpoint
  "/api/csp-report",
  // Versioned (v1) equivalents of public routes — rewrites in next.config.ts
  // map these to the underlying unversioned handlers, but middleware auth
  // runs before rewrites so each must be allowlisted explicitly.
  "/api/v1/booking",
  "/api/v1/booking/verify",
  "/api/v1/booking/cancel",
  "/api/v1/webhooks",
  "/api/v1/payments/webhook",
  "/api/v1/payments/cmi/callback",
  "/api/v1/checkin/lookup",
  "/api/v1/checkin/confirm",
  "/api/v1/checkin/status",
  "/api/v1/chat",
  "/api/v1/consent",
  "/api/v1/notifications",
];

/**
 * Check if an API route is in the public allowlist.
 * Supports both exact matches and prefix matches (for routes ending with /).
 */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => {
    if (route.endsWith("/")) {
      // Prefix match for route groups (e.g. "/api/cron/")
      return pathname.startsWith(route);
    }
    // Exact match or sub-path match
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

/**
 * Determine whether a route is public (no middleware-level auth check).
 *
 * API routes are now **protected by default**. Only routes explicitly
 * listed in PUBLIC_API_ROUTES are treated as public. All other `/api/`
 * routes require the user to be authenticated at the middleware level.
 *
 * Route handlers can still implement additional auth (role checks, API key
 * validation, etc.) on top of the middleware-level session check.
 */
export function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith("/api/")) {
    return isPublicApiRoute(pathname);
  }
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Get the dashboard path for a given role.
 */
function _getDashboardPath(role: string): string {
  return ROLE_DASHBOARD_MAP[role];
}
