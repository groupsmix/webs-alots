/**
 * Demo tenant utilities.
 *
 * Centralises the demo clinic ID and provides helpers to check
 * whether the current request / tenant is the demo tenant.
 */

/** The well-known UUID for the demo clinic (seeded in migration 00046). */
export const DEMO_CLINIC_ID = "c0000000-de00-0000-0000-000000000001";

/** The subdomain used for the demo tenant. */
export const DEMO_SUBDOMAIN = "demo";

/** Demo user IDs for one-click login. */
export const DEMO_USERS = {
  doctor: {
    id: "b0000000-de00-0000-0000-000000000002",
    email: "karim@demo.oltigo.com",
    name: "Dr. Karim Idrissi",
    role: "doctor" as const,
  },
  receptionist: {
    id: "b0000000-de00-0000-0000-000000000004",
    email: "imane@demo.oltigo.com",
    name: "Imane Fassi",
    role: "receptionist" as const,
  },
  patient: {
    id: "b0000000-de00-0000-0000-000000000010",
    email: "rachid@example.com",
    name: "Rachid Bennani",
    role: "patient" as const,
  },
} as const;

/**
 * Check if a clinic ID is the demo tenant.
 */
export function isDemoClinic(clinicId: string | null | undefined): boolean {
  return clinicId === DEMO_CLINIC_ID;
}

/**
 * Check if a subdomain belongs to the demo tenant.
 */
export function isDemoSubdomain(subdomain: string | null | undefined): boolean {
  return subdomain === DEMO_SUBDOMAIN;
}

/**
 * HTTP methods that are considered destructive (mutating).
 * In demo mode, these should be blocked or simulated.
 */
export const DESTRUCTIVE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * API paths that are allowed even in demo mode (e.g., auth, read-only endpoints).
 *
 * Note: `/api/branding` is intentionally NOT included here.
 * Branding GET requests pass through because GET is not a destructive method.
 * Branding POST/PUT (file uploads, config changes) are blocked to prevent
 * demo users from polluting R2 storage (SEED-02).
 */
export const DEMO_ALLOWED_PATHS = new Set([
  "/api/auth",
  "/api/v1/register-clinic",
]);

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
  if (!DESTRUCTIVE_METHODS.has(method.toUpperCase())) return false;

  // Allow certain paths through even for demo
  for (const allowed of DEMO_ALLOWED_PATHS) {
    if (pathname.startsWith(allowed)) return false;
  }

  return true;
}

/**
 * F-39: Decorator-style wrapper that marks a route handler as safe for
 * demo mode. Handlers NOT wrapped with demoSafe will be blocked by
 * default when the request targets the demo tenant with a destructive
 * HTTP method.
 *
 * Usage:
 *   export const POST = demoSafe(withAuth(async (req, ctx) => { ... }));
 *
 * This replaces the path/method allow-list approach with an explicit
 * opt-in per route handler.
 */
export function demoSafe<T extends (...args: never[]) => unknown>(
  handler: T,
): T {
  // Tag the handler so middleware or withAuth can check it
  (handler as unknown as Record<string, unknown>).__demoSafe = true;
  return handler;
}

/**
 * Check if a handler has been marked as demo-safe via the demoSafe wrapper.
 */
export function isDemoSafeHandler(handler: unknown): boolean {
  return (
    typeof handler === "function" &&
    (handler as unknown as Record<string, unknown>).__demoSafe === true
  );
}
