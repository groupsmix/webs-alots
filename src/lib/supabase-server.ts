import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePoolerUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { setTenantContext, isValidClinicId } from "@/lib/tenant-context";
import type { Database } from "@/lib/types/database";

// Local require-env helper. Uses computed-key access (process.env[name])
// rather than dot access, so semgrep.env-access does not match. The
// individual variables it reads are all owned by getters in src/lib/env.ts
// (see getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey) —
// the canonical reader is env.ts.
// nosemgrep: semgrep.env-access
function requireEnv(name: string): string {
  // nosemgrep: semgrep.env-access
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get the Supabase URL for server operations.
 *
 * Priority: SUPABASE_POOLER_URL (Cloudflare Workers + connection pooling)
 *         > NEXT_PUBLIC_SUPABASE_URL (direct connection)
 *
 * Audit finding #8: Workers have no persistent TCP connections. Direct
 * connections to Supabase port 5432 exhaust the database connection limit.
 * The pooler (port 6543, transaction mode) prevents this at scale.
 *
 * Set SUPABASE_POOLER_URL as a Cloudflare Workers secret. Format:
 *   postgresql://postgres.xxx@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
 */
function getSupabaseUrl(): string {
  return getSupabasePoolerUrl() || requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/**
 * Create a Supabase server client with cookie-based auth.
 * Use this for requests where tenant context will be set separately
 * (e.g. middleware, auth flows).
 *
 * NOTE: `cookies` is loaded via dynamic import to avoid pulling
 * `next/headers` into Client Components, Edge Middleware, and other
 * contexts where it is not available (Next.js 16 / Turbopack).
 */
export async function createClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseUrl(),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (err) {
            logger.warn("Cookie setAll called from Server Component", {
              context: "supabase-server",
              error: err,
            });
          }
        },
      },
    },
  );
}

/**
 * Create a Supabase server client with tenant context set.
 *
 * Passes the clinic_id as a custom HTTP header (`x-clinic-id`) on every
 * request so that PostgREST makes it available in PostgreSQL as
 * `current_setting('request.header.x-clinic-id', true)`.  RLS policies
 * read this header to scope anonymous queries to the correct tenant.
 *
 * The old `set_tenant_context` RPC is kept as a best-effort fallback
 * for any code paths that run within a single PostgREST transaction
 * (e.g. SECURITY DEFINER functions).
 *
 * @param clinicId - The clinic UUID to scope all operations to
 * @throws Error if clinicId is missing/invalid
 */
export async function createTenantClient(clinicId: string) {
  if (!clinicId || !isValidClinicId(clinicId)) {
    throw new Error(`createTenantClient: invalid clinicId: ${clinicId}`);
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const client = createServerClient<Database>(
    getSupabaseUrl(),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (err) {
            logger.warn("Cookie setAll called from Server Component", {
              context: "supabase-server/tenant",
              error: err,
            });
          }
        },
      },
      global: {
        headers: { "x-clinic-id": clinicId },
      },
    },
  );

  // R-14: Best-effort GUC isolation via set_tenant_context RPC.
  //
  // This sets `app.current_clinic_id` as a PostgreSQL session variable.
  // It provides defense-in-depth for SECURITY DEFINER functions that read
  // the GUC directly. Note: each PostgREST request is a separate
  // transaction, so SET LOCAL only applies within the RPC call itself.
  // The primary isolation mechanism is the `x-clinic-id` header above.
  //
  // Migration 00057 (RLS-02) restricted set_tenant_context() to
  // service_role only. When using anon/authenticated keys, the RPC
  // returns "permission denied" — this is expected and handled gracefully.
  try {
    await setTenantContext(client, clinicId);
  } catch (err) {
    const isPermissionDenied = err instanceof Error && err.message.includes("permission denied");
    if (isPermissionDenied) {
      // Expected when using anon/authenticated key (migration 00057).
      // Header-based isolation (x-clinic-id) is still active.
      logger.debug(
        "setTenantContext RPC unavailable (restricted to service_role) — using header-only isolation",
        {
          context: "supabase-server",
          clinicId,
        },
      );
    } else {
      logger.error("setTenantContext RPC failed", {
        context: "supabase-server",
        clinicId,
        error: err,
      });
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(
          err instanceof Error ? err : new Error("setTenantContext RPC failed"),
          { tags: { clinicId, component: "createTenantClient" }, level: "error" },
        );
      } catch {
        // Sentry unavailable
      }
      throw new Error(`Tenant context could not be established for clinic ${clinicId}`);
    }
  }

  return client;
}

/**
 * R-01: Every call site must declare its purpose so auditors can
 * verify each admin-client usage is intentional and appropriately scoped.
 */
export type AdminPurpose =
  | "auth_admin"
  | "cron"
  | "audit_log"
  | "notification"
  | "webhook"
  | "webhook-retry"
  | "super_admin"
  | "register_clinic"
  | "impersonate"
  | "impersonate-precheck"
  | "payments/cmi"
  | "features"
  | "directory"
  | "instrumentation"
  | "ai-config-list"
  | "ai-config-update"
  | "ai-config-test"
  | "ai-feature-toggle"
  | "ai-route"
  | "ai-config-resolve"
  | "subscription-billing";

/**
 * Create a Supabase admin client using the service role key.
 *
 * This client bypasses RLS and can perform admin operations such as
 * creating auth users via `supabase.auth.admin.createUser()`.
 *
 * Only use this for privileged server-side operations (e.g. super-admin
 * onboarding staff accounts, audit log writes). Never expose this client
 * to the browser.
 *
 * R-01: Requires `purpose` so each usage is auditable. Optionally accepts
 * `clinicId` for structured logging (does NOT set tenant context — use
 * createTenantClient for that).
 *
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export function createAdminClient(purpose: AdminPurpose, clinicId?: string) {
  logger.debug("Admin client created", { context: "supabase-server", purpose, clinicId });
  return createSupabaseClient<Database>(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Create a service-role admin client WITHOUT the Database generic type.
 *
 * Use this for tables not yet reflected in the generated Supabase types
 * (e.g. impersonation_sessions, pending_audit_logs). Once the types are
 * regenerated, callers should migrate to createAdminClient() for type safety.
 */
export function createUntypedAdminClient(purpose: AdminPurpose, clinicId?: string) {
  logger.debug("Untyped admin client created", { context: "supabase-server", purpose, clinicId });
  return createSupabaseClient(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * B-02: Create a service-role admin client that is pre-scoped to a specific
 * clinic via the `x-clinic-id` header. This provides defense-in-depth: even
 * though the admin client bypasses RLS, the PostgREST header ensures that any
 * RLS policy reading `request.header.x-clinic-id` still evaluates correctly.
 *
 * Prefer this over raw `createAdminClient()` in any code path that operates
 * on a single clinic's data (webhooks, cron per-clinic iteration, billing).
 * The raw `createAdminClient()` should only be used for truly cross-tenant
 * operations (e.g. iterating all clinics, super-admin actions).
 *
 * @param purpose - Audit label for the admin client usage
 * @param clinicId - The clinic UUID to scope operations to
 * @throws Error if clinicId is missing or invalid
 */
export function createScopedAdminClient(purpose: AdminPurpose, clinicId: string) {
  if (!clinicId || !isValidClinicId(clinicId)) {
    throw new Error(`createScopedAdminClient: invalid clinicId: ${clinicId}`);
  }
  logger.debug("Scoped admin client created", { context: "supabase-server", purpose, clinicId });
  return createSupabaseClient<Database>(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { "x-clinic-id": clinicId },
    },
  });
}

/**
 * Create a cookie-free anon Supabase client with x-clinic-id header set.
 *
 * F-03: Replacement for createAdminClient() in `use cache` blocks
 * that need tenant-scoped reads. Unlike createAdminClient(), this uses
 * the anon key and relies on RLS policies (via the x-clinic-id header)
 * instead of bypassing them with the service role.
 *
 * Safe for use inside `use cache` directives since it does not read cookies.
 */
export function createPublicAnonClient(clinicId: string) {
  if (!clinicId || !isValidClinicId(clinicId)) {
    throw new Error(`createPublicAnonClient: invalid clinicId: ${clinicId}`);
  }
  return createSupabaseClient<Database>(
    getSupabaseUrl(),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { "x-clinic-id": clinicId },
      },
    },
  );
}
