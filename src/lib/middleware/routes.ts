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
const PUBLIC_PREFIXES = ["/pharmacy", "/dentist"];

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
  // Cron jobs — FP-02: removed from public allowlist; verifyCronSecret
  // is now enforced at the middleware level for all /api/cron/ routes.
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
  // Demo-request lead capture — prospective clinics submit from the public
  // marketing landing page before they are tenants (no session/clinic context)
  "/api/leads",
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
 * S0-1-03: Sanitize a post-login redirect path. Rejects protocol-relative
 * values (`//evil.example`, `/\evil.example`) and anything that isn't a
 * simple same-origin path, preventing open-redirect attacks via the
 * `?redirect=` query param.
 *
 * Lives here (not inline in middleware.ts) so it is unit-testable without
 * pulling in the Next.js edge runtime.
 */
export function safeRedirectPath(raw: string): string {
  // P2-3: Decode percent-encoding so look-alike / encoded separators are
  // resolved before validation (e.g. `%2F%2Fevil`, `%5Cevil`). A prior
  // `decodeURIComponent(encodeURIComponent(raw))` round-trip re-encoded the
  // `%` of any literal `%2F`/`%5C`, so encoded separators slipped through
  // un-decoded. decodeURIComponent throws on malformed sequences (e.g. a lone
  // `%E0%A4`), and this runs in the Worker hot path for every protected route,
  // so it MUST be wrapped — an unhandled URIError would 500 the redirect.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }

  // NFKC-normalize first. NOTE: NFKC only folds *fullwidth* solidus (U+FF0F)
  // and reverse solidus (U+FF3C/U+FE68) to `/`/`\` — it does NOT fold U+2215
  // DIVISION SLASH, U+2044 FRACTION SLASH, or U+29F8 BIG SOLIDUS. So we cannot
  // rely on normalization alone (the old code's comment claimed it defeated
  // U+2215; it did not). The allowlist below is what actually closes this.
  const normalized = decoded.normalize("NFKC");

  // Bare root is fine.
  if (normalized === "/") return "/";

  // P2-2: A safe same-origin path is exactly one leading `/` followed by a
  // character from a strict ASCII path-legal set. This rejects, in one check:
  //   - `//evil.com`           (protocol-relative)
  //   - `/\evil.com`           (browsers treat `\` as `/` in the authority)
  //   - `/∕evil.com`, `/⁄x`    (Unicode slash look-alikes NFKC leaves intact)
  //   - any other non-path leading byte
  // The set is RFC 3986 unreserved + sub-delims + `:@%` (all legal at the start
  // of a path segment); notably it excludes `/` and `\` and every non-ASCII
  // char, so look-alike separators can never appear in the authority position.
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%-]/.test(normalized)) return "/";

  return normalized;
}
