/**
 * Demo tenant utilities.
 *
 * Centralises the demo clinic ID and provides helpers to check
 * whether the current request / tenant is the demo tenant.
 */

/** The well-known UUID for the demo clinic (seeded in migration 00046). */
const DEMO_CLINIC_ID = process.env.DEMO_CLINIC_ID || "c0000000-de00-0000-0000-000000000001";

/** The subdomain used for the demo tenant. */
export const DEMO_SUBDOMAIN = "demo";

/** Demo user IDs for one-click login. */
// F-14: Use @example.invalid (RFC 2606 reserved domain) for demo seed users
// to prevent any possibility of emails being sent to real addresses.
export const DEMO_USERS = {
  doctor: {
    id: "b0000000-de00-0000-0000-000000000002",
    email: "karim@example.invalid",
    name: "Dr. Karim Idrissi",
    role: "doctor" as const,
  },
  receptionist: {
    id: "b0000000-de00-0000-0000-000000000004",
    email: "imane@example.invalid",
    name: "Imane Fassi",
    role: "receptionist" as const,
  },
  patient: {
    id: "b0000000-de00-0000-0000-000000000010",
    email: "rachid@example.invalid",
    name: "Rachid Bennani",
    role: "patient" as const,
  },
} as const;

/**
 * Check if a clinic ID is the demo tenant.
 */
function isDemoClinic(clinicId: string | null | undefined): boolean {
  return clinicId === DEMO_CLINIC_ID;
}

/**
 * HTTP methods that are considered destructive (mutating).
 * In demo mode, these should be blocked or simulated.
 */
const DESTRUCTIVE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * API paths that are allowed even in demo mode (e.g., auth, read-only endpoints).
 *
 * Note: `/api/branding` is intentionally NOT included here.
 * Branding GET requests pass through because GET is not a destructive method.
 * Branding POST/PUT (file uploads, config changes) are blocked to prevent
 * demo users from polluting R2 storage (SEED-02).
 *
 * Webhook and cron paths are exempt: they receive POSTs from external
 * services (Meta, Stripe, CMI, Cloudflare Cron) that authenticate via
 * signature verification or bearer token rather than the user-facing
 * demo-mode UI. Blocking them with a 403 would prevent the route handler's
 * own auth check from running and cause E2E signature-validation tests
 * (which legitimately exercise these endpoints under the demo subdomain)
 * to fail before reaching the handler.
 */
const DEMO_ALLOWED_PATHS = new Set([
  "/api/auth",
  "/api/v1/register-clinic",
  "/api/webhooks",
  "/api/payments/webhook",
  "/api/payments/cmi/callback",
  "/api/billing/webhook",
  "/api/cron/",
]);

/**
 * QA/pilot escape hatch: when `DEMO_ALLOW_MUTATIONS=true`, destructive
 * requests on the demo tenant are permitted so the demo can be exercised
 * end-to-end (walk-in registration, branding changes, etc.).
 *
 * Secure by default: any value other than the exact string "true" (including
 * unset) keeps the demo tenant read-only. This flag must never be enabled in
 * the production environment — it exists for QA and pilot walkthroughs.
 */
function demoMutationsAllowed(): boolean {
  return process.env.DEMO_ALLOW_MUTATIONS === "true";
}

/**
 * Check if a request should be blocked in demo mode.
 * Returns true if the request is a destructive action on the demo tenant.
 */
export function shouldBlockDemoRequest(
  method: string,
  pathname: string,
  clinicId: string | null | undefined,
): boolean {
  if (!isDemoClinic(clinicId)) return false;
  if (demoMutationsAllowed()) return false;
  if (!DESTRUCTIVE_METHODS.has(method.toUpperCase())) return false;

  // Allow certain paths through even for demo
  for (const allowed of DEMO_ALLOWED_PATHS) {
    if (pathname.startsWith(allowed)) return false;
  }

  return true;
}
