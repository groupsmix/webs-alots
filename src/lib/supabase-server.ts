import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { withChaos, isChaosEnabled } from "@/lib/chaos/chaos-engine";
import { getSupabasePoolerUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { setTenantContext, isValidClinicId } from "@/lib/tenant-context";
import type { Database } from "@/lib/types/database";

// Local require-env helper. Reads via computed-key access (process.env[name]).
// The individual variables it reads are all owned by getters in src/lib/env.ts
// (see getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey) — the
// canonical reader is env.ts. The env-access rule also matches bracket access,
// so the suppressions below are intentional and documented.
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
 * Get the HTTP base URL for the supabase-js clients below.
 *
 * IMPORTANT: `createServerClient` / `createClient` (supabase-js) talk to
 * PostgREST, GoTrue and Realtime over **HTTPS** — they never open a raw
 * Postgres TCP connection. The Supabase transaction pooler
 * (`postgresql://…@…pooler.supabase.com:6543/postgres`) is a Postgres
 * wire-protocol endpoint for *direct* DB drivers (migrations, backups via
 * `SUPABASE_DB_URL`), so it must NOT be used as the base URL here — doing so
 * would point every REST/Auth call at an invalid origin and break the app.
 * PostgREST already pools connections server-side (Supavisor), so supabase-js
 * gains nothing from the pooler URL. See `src/lib/connection-pooling.ts`.
 *
 * For backward compatibility we still honour `SUPABASE_POOLER_URL` if (and
 * only if) it was set to an HTTP(S) origin; any `postgresql://` value is
 * ignored in favour of the canonical `NEXT_PUBLIC_SUPABASE_URL`.
 */
function getSupabaseUrl(): string {
  const poolerUrl = getSupabasePoolerUrl();
  if (poolerUrl && /^https?:\/\//i.test(poolerUrl)) {
    return poolerUrl;
  }
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
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
              cookieStore.set(name, value, {
                ...options,
                // Harden auth/session cookies: only sent over HTTPS in
                // production (left off for http://localhost dev), and pinned to
                // SameSite=Lax + root path. NOTE: these stay non-HttpOnly on
                // purpose — the @supabase/ssr browser client reads them via
                // document.cookie; HttpOnly would break client-side auth and
                // needs the larger server-session refactor instead.
                // nosemgrep: semgrep.env-access -- NODE_ENV is a non-secret build/runtime constant (read directly elsewhere: cors.ts, email.ts, chaos-engine.ts); routing it through env.ts adds no safety
                secure: process.env.NODE_ENV === "production",
                sameSite: options?.sameSite ?? "lax",
                path: options?.path ?? "/",
              }),
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

  return applyChaos(client);
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
              cookieStore.set(name, value, {
                ...options,
                // Harden auth/session cookies: only sent over HTTPS in
                // production (left off for http://localhost dev), and pinned to
                // SameSite=Lax + root path. NOTE: these stay non-HttpOnly on
                // purpose — the @supabase/ssr browser client reads them via
                // document.cookie; HttpOnly would break client-side auth and
                // needs the larger server-session refactor instead.
                // nosemgrep: semgrep.env-access -- NODE_ENV is a non-secret build/runtime constant (read directly elsewhere: cors.ts, email.ts, chaos-engine.ts); routing it through env.ts adds no safety
                secure: process.env.NODE_ENV === "production",
                sameSite: options?.sameSite ?? "lax",
                path: options?.path ?? "/",
              }),
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

  return applyChaos(client);
}

/**
 * R-01: Every call site must declare an audit label so each admin-client
 * usage is traceable in structured logs. This is a LOG LABEL ONLY — it
 * provides no access control. The real gate is always the handler's
 * withAuth([roles]) / verifyCronSecret / webhook signature check.
 */
export type AdminAuditLabel =
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
  | "impersonate-callback"
  | "payments/cmi"
  | "features"
  | "directory"
  | "instrumentation"
  | "ai-config-list"
  | "ai-config-update"
  | "ai-config-test"
  | "ai-feature-toggle"
  | "ai-task-config"
  | "ai-task-config-list"
  | "ai-task-config-update"
  | "ai-route"
  | "ai-config-resolve"
  | "subscription-billing"
  | "whatsapp-credentials"
  | "trial-start"
  | "trial-end"
  | "trial-lifecycle"
  | "audit"
  | "cron-ai-briefings"
  | "cron-trial-lifecycle"
  | "cron-usage-snapshots"
  | "referral-program"
  | "streaming-chat"
  | "upload-policy"
  | "seed-guard"
  | "rag-chat"
  | "ai-embed"
  | "patient-registration"
  | "ai-memory"
  | "ai-memory-consolidate"
  | "ai-team-tasks"
  | "ai-team-review"
  | "ai-triage"
  | "ai-tracing"
  | "super_admin_feature_flags";

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
 * R-01: Requires `auditLabel` so each usage is traceable in structured logs.
 * NOTE: `auditLabel` is a LOG LABEL ONLY — it provides no access control.
 * The real gate is always the handler's withAuth([roles]) / verifyCronSecret /
 * webhook signature check. Optionally accepts `clinicId` for structured
 * logging (does NOT set tenant context — use createTenantClient for that).
 *
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export function createAdminClient(auditLabel: AdminAuditLabel, clinicId?: string) {
  logger.debug("Admin client created", { context: "supabase-server", auditLabel, clinicId });
  const client = createSupabaseClient<Database>(
    getSupabaseUrl(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return applyChaos(client);
}

/**
 * Create a service-role admin client WITHOUT the Database generic type.
 *
 * Use this for tables not yet reflected in the generated Supabase types
 * (e.g. impersonation_sessions, pending_audit_logs). Once the types are
 * regenerated, callers should migrate to createAdminClient() for type safety.
 */
export function createUntypedAdminClient(auditLabel: AdminAuditLabel, clinicId?: string) {
  logger.debug("Untyped admin client created", {
    context: "supabase-server",
    auditLabel,
    clinicId,
  });
  const client = createSupabaseClient(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return applyChaos(client);
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
 * @param auditLabel - Audit label for the admin client usage
 * @param clinicId - The clinic UUID to scope operations to
 * @throws Error if clinicId is missing or invalid
 */
export function createScopedAdminClient(auditLabel: AdminAuditLabel, clinicId: string) {
  if (!clinicId || !isValidClinicId(clinicId)) {
    throw new Error(`createScopedAdminClient: invalid clinicId: ${clinicId}`);
  }
  logger.debug("Scoped admin client created", { context: "supabase-server", auditLabel, clinicId });
  const client = createSupabaseClient<Database>(
    getSupabaseUrl(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { "x-clinic-id": clinicId },
      },
    },
  );
  return applyChaos(client);
}

/**
 * Create a cookie-free service-role client for server-only background work.
 *
 * Use this from webhook handlers, public intake endpoints, or system metrics
 * routes that cannot rely on a browser session but still need privileged
 * access. Prefer `createScopedAdminClient()` when the operation is scoped to
 * one clinic; use this raw variant only for cross-tenant/system tasks.
 */
export function createServiceClient() {
  logger.debug("Service client created", { context: "supabase-server" });
  const client = createSupabaseClient<Database>(
    getSupabaseUrl(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return applyChaos(client);
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
  const client = createSupabaseClient<Database>(
    getSupabaseUrl(),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { "x-clinic-id": clinicId },
      },
    },
  );
  return applyChaos(client);
}

/**
 * Wraps a Supabase client with chaos engineering experiments.
 * Intercepts database queries to simulate timeouts and failures.
 */
function applyChaos<T>(supabase: T): T {
  // Chaos is opt-in via CHAOS_ENABLED and is never enabled in CI or production.
  // When disabled, return the client untouched so the Supabase query builder
  // stays chainable (.from().select().eq().single() etc.). Wrapping .select()
  // in an async function otherwise turns it into a Promise, breaking every
  // filtered query with "select(...).eq is not a function".
  if (!isChaosEnabled()) {
    return supabase;
  }
  // Wrap database operations with chaos
  // @ts-expect-error Proxying complex Supabase types is hard
  return new Proxy(supabase, {
    get(target, prop) {
      if (prop === "from") {
        return (table: string) => {
          // @ts-expect-error Proxying complex Supabase types is hard
          return wrapChaosBuilder(target.from(table));
        };
      }

      // @ts-expect-error Proxying complex Supabase types is hard
      return target[prop];
    },
  });
}

/**
 * Wrap a PostgREST query builder so chaos is injected at execution time
 * (when the builder's thenable resolves) instead of around each chain method.
 *
 * The previous implementation wrapped `.select()/.insert()/.update()/.delete()`
 * in `async` functions, which turned them into Promises and broke every
 * filtered chain (`.select(...).eq(...)` → "eq is not a function"). Supabase
 * builders are thenable and most filter methods return the same builder, so we
 * intercept `then` and re-wrap any builder a method returns, keeping the full
 * chain intact while still simulating timeouts/failures on the final await.
 */
function wrapChaosBuilder<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        // Execute the real query inside the chaos wrapper on await.
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) =>
          withChaos("database_timeout", () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const thenable = target as unknown as PromiseLike<any>;
            return Promise.resolve(thenable);
          }).then(onFulfilled, onRejected);
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          // Re-wrap chainable builders (objects that are still thenable) so
          // chaos continues to apply no matter how deep the chain goes.
          if (
            result &&
            typeof result === "object" &&
            typeof (result as { then?: unknown }).then === "function"
          ) {
            return wrapChaosBuilder(result as object);
          }
          return result;
        };
      }
      return value;
    },
  }) as T;
}
