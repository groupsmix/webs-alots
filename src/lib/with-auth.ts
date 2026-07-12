/**
 * Shared authentication middleware for API route handlers.
 *
 * Eliminates the repeated boilerplate of:
 *   1. createClient()
 *   2. supabase.auth.getUser()
 *   3. Fetch user profile from `users` table
 *   4. Check role against allowed roles
 *
 * Usage:
 *   export const POST = withAuth(handler, ["super_admin", "clinic_admin"]);
 *
 * The wrapped handler receives the original request plus an `auth` object
 * containing the authenticated Supabase client, user, and profile.
 *
 * P8 refactor: the shared auth-resolution flow (getUser → profile headers →
 * DB fallback → tenant assertion → tenant context → rate limit) now lives in
 * the private `resolveAuthProfile` helper below. Both `withAuth` and
 * `withAuthAnyRole` call that helper; the only difference between them is
 * whether `allowedRoles` is checked before invoking the handler.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, type NextResponse } from "next/server";
import { isApiGroupAllowed } from "@/lib/api-gating";
import {
  apiError,
  apiForbidden,
  apiInternalError,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api-response";
import { isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifyProfileHeader, PROFILE_HEADER_NAMES } from "@/lib/profile-header-hmac";
import { perUserLimiter } from "@/lib/rate-limit";
import { applyRequestScopedResponseHeaders } from "@/lib/request-context-response-headers";
import { createClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database";

/**
 * True when `setTenantContext` failed because the current Postgres role lacks
 * EXECUTE on the service_role-only `set_tenant_context` function — the EXPECTED
 * outcome for the authenticated user client. Detected by error name (not
 * `instanceof`) so it stays correct under module mocking and minification.
 */
function isTenantContextPermissionError(err: unknown): boolean {
  return (err as { name?: string } | null | undefined)?.name === "TenantContextPermissionError";
}

interface AuthenticatedUser {
  id: string;
  email?: string | null;
  [key: string]: unknown;
}

export interface AuthContext {
  supabase: SupabaseClient<Database>;
  user: AuthenticatedUser;
  profile: { id: string; role: UserRole; clinic_id: string | null };
}

// Generic over an optional route-context arg (Next.js 15 dynamic routes
// pass `{ params: Promise<...> }` as the third argument to the route
// handler). RouteCtx defaults to `unknown` so handlers without dynamic
// segments keep their original two-argument signature.
type AuthenticatedHandler<RouteCtx = unknown> = (
  request: NextRequest,
  auth: AuthContext,
  routeCtx?: RouteCtx,
) => Promise<NextResponse>;

/**
 * Options for the `withAuth` / `withAuthAnyRole` wrappers.
 *
 * `failOpen` controls behavior when `setTenantContext` cannot be applied to
 * the Supabase client. The default is **fail-closed** — a failure to set the
 * Postgres session variable that RLS policies depend on must abort the
 * request with a 503, because continuing would leave the request relying on
 * weaker fallback isolation checks (`get_user_clinic_id()` alone) on a route
 * that the application clearly intended to be tenant-scoped.
 *
 * Pass `failOpen: true` ONLY for explicit, read-only routes that never
 * touch tenant data and where RLS-without-context is acceptable. This must
 * be a deliberate, audited decision per route — never the default.
 */
export interface WithAuthOptions {
  failOpen?: boolean;
}

// ── Private resolution result ────────────────────────────────────────────────

interface ResolvedAuth {
  supabase: SupabaseClient<Database>;
  user: AuthenticatedUser;
  profile: { id: string; role: UserRole; clinic_id: string | null };
}

type ResolutionError = NextResponse;

/**
 * Core auth-resolution pipeline shared by `withAuth` and `withAuthAnyRole`.
 *
 * Returns a `ResolvedAuth` on success or a `NextResponse` (error) on failure.
 * The caller is responsible for the role-allowlist check (if any) and for
 * invoking the actual route handler.
 *
 * @param request  - The incoming Next.js request
 * @param context  - Wrapper label used in logs ("with-auth" | "with-auth-any-role")
 * @param failOpen - Whether tenant-context errors should fail open (default: false)
 */
async function resolveAuthProfile(
  request: NextRequest,
  context: string,
  failOpen: boolean,
): Promise<ResolvedAuth | ResolutionError> {
  const supabase = await createClient();
  const authClient = supabase.auth as unknown as {
    getUser: () => Promise<{ data: { user: AuthenticatedUser | null } }>;
  };

  const {
    data: { user },
  } = await authClient.getUser();

  if (!user) {
    return apiUnauthorized("Not authenticated");
  }

  // Check for signed profile headers from middleware to avoid double-querying (Audit P1 #8).
  // R-01: If the header HMAC key is unset, `verifyProfileHeader` returns null so we
  //       fall through to the authoritative DB lookup below. We never trust these
  //       headers without a valid signature.
  // C-02: The `iat` header is now required for verification — expired headers are rejected.
  const verified = await verifyProfileHeader({
    id: request.headers.get(PROFILE_HEADER_NAMES.id),
    role: request.headers.get(PROFILE_HEADER_NAMES.role),
    clinic_id: request.headers.get(PROFILE_HEADER_NAMES.clinic),
    signature: request.headers.get(PROFILE_HEADER_NAMES.sig),
    iat: request.headers.get(PROFILE_HEADER_NAMES.iat),
  });

  let profile: { id: string; role: UserRole; clinic_id: string | null } | null = verified
    ? { id: verified.id, role: verified.role as UserRole, clinic_id: verified.clinic_id }
    : null;

  if (!profile && request.headers.get(PROFILE_HEADER_NAMES.sig)) {
    logger.warn(
      "Profile headers present but signature could not be verified — falling back to DB",
      { context, userId: user.id },
    );
  }

  if (!profile) {
    // Always fetch the real profile from the database if headers are missing or invalid
    const { data: dbProfile } = await supabase
      .from("users")
      .select("id, role, clinic_id")
      .eq("auth_id", user.id)
      .single();
    profile = dbProfile as { id: string; role: UserRole; clinic_id: string | null } | null;
  }

  if (!profile) {
    return apiNotFound("User profile not found");
  }

  // F-08: Assert the user's clinic_id matches the subdomain-resolved tenant
  // to prevent cross-tenant access via tampered profile data.
  if (profile.clinic_id && profile.role !== "super_admin") {
    try {
      const tenant = await getTenant();
      if (tenant && profile.clinic_id !== tenant.clinicId) {
        logger.error("Tenant mismatch: profile.clinic_id does not match subdomain tenant", {
          context,
          profileClinicId: profile.clinic_id.slice(0, 8) + "…",
          subdomainClinicId: tenant.clinicId.slice(0, 8) + "…",
          userId: profile.id,
        });
        return apiForbidden("Forbidden — tenant mismatch");
      }
    } catch (tenantErr) {
      logger.warn("Could not resolve tenant for assertion", { context, error: tenantErr });
    }
  }

  // Set tenant context on the Supabase client so RLS policies
  // can use app.current_clinic_id as an additional isolation check.
  // Default behavior is fail-closed: if we cannot establish the tenant
  // session variable, abort with 503 rather than silently relying on
  // the weaker `get_user_clinic_id()` fallback for a tenant-scoped
  // route. Routes that explicitly opt into `failOpen: true` (e.g. a
  // read-only public endpoint that never touches tenant data) keep
  // the legacy log-and-continue behavior.
  if (profile.clinic_id) {
    try {
      await setTenantContext(supabase, profile.clinic_id);
    } catch (tenantErr) {
      if (isTenantContextPermissionError(tenantErr)) {
        // Expected: the authenticated user role cannot set the
        // app.current_clinic_id GUC (set_tenant_context is service_role-only).
        // This is NOT a reason to fail closed — tenant isolation is enforced
        // by RLS (get_user_clinic_id + the x-clinic-id tenant client), not by
        // this best-effort session variable. Log at debug and continue.
        logger.debug(
          "Tenant GUC not set (expected for authenticated role); RLS enforces isolation",
          { context, clinicId: profile.clinic_id },
        );
      } else {
        logger.error(`Failed to set tenant context in ${context}`, {
          context,
          clinicId: profile.clinic_id,
          failOpen,
          error: tenantErr,
        });
        if (!failOpen) {
          return apiError("Tenant context unavailable", 503, "TENANT_CONTEXT_UNAVAILABLE");
        }
      }
    }
  }

  logTenantContext(profile.clinic_id, context, { userId: profile.id, role: profile.role });

  return { supabase, user, profile };
}

// ── Public wrappers ──────────────────────────────────────────────────────────

/**
 * Wraps a Next.js API route handler with authentication and role checks.
 *
 * @param handler - The route handler that receives the request and auth context
 * @param allowedRoles - Array of roles permitted to access this endpoint.
 *                       At least one role must be provided. Use withAuthAnyRole
 *                       if any authenticated user should be allowed.
 *
 * R-04: Removed the null overload. Use withAuthAnyRole() instead for
 * allow-any-authenticated behavior. This enforces deny-by-default.
 */
export function withAuth<RouteCtx = unknown>(
  handler: AuthenticatedHandler<RouteCtx>,
  allowedRoles: UserRole[],
  options: WithAuthOptions = {},
) {
  const failOpen = options.failOpen === true;
  return async (request: NextRequest, routeCtx?: RouteCtx): Promise<NextResponse> => {
    const finalize = (response: NextResponse): NextResponse => {
      applyRequestScopedResponseHeaders(request, response);
      if (!response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "private, no-store");
      }
      return response;
    };

    try {
      const result = await resolveAuthProfile(request, "with-auth", failOpen);

      // resolveAuthProfile returns a NextResponse on any auth/tenant failure.
      if (!("supabase" in result)) return finalize(result);

      const { supabase, user, profile } = result;

      // If specific roles are required, enforce them.
      // R-04: withAuth no longer accepts null for allowedRoles.
      // Use withAuthAnyRole() for any-authenticated behavior.
      if (!allowedRoles.includes(profile.role as UserRole)) {
        return finalize(apiForbidden("Forbidden — insufficient permissions"));
      }

      // AUDIT-24 / S0-07-03: Per-user rate limiting for authenticated API
      // requests (100 req/min per user). Backed by the shared distributed
      // limiter (KV / Supabase) so the cap is authoritative across the
      // Workers fleet instead of being per-isolate. Falls back to in-memory
      // only when no distributed backend is configured (dev / single host).
      if (!(await perUserLimiter.check(`user:${profile.id}`))) {
        return finalize(apiError("Too many requests. Please slow down.", 429, "USER_RATE_LIMIT"));
      }

      // ADR-0013 / Lane-A: Gate Architecture-B API groups by feature flag.
      // Operational groups are not gated. If tenant context cannot be resolved
      // the gate falls closed for gated groups and open for operational groups.
      let tenantTypeKey: string | undefined;
      try {
        const tenant = await getTenant();
        tenantTypeKey = tenant?.clinicType;
      } catch (tenantErr) {
        logger.warn("Could not resolve tenant for API gate", {
          context: "with-auth",
          error: tenantErr,
        });
      }
      if (!(await isApiGroupAllowed(supabase, request.nextUrl.pathname, tenantTypeKey))) {
        logger.warn("API route gated by feature flag", {
          context: "with-auth",
          path: request.nextUrl.pathname,
          userId: profile.id,
          clinicId: profile.clinic_id,
        });
        return finalize(apiForbidden("Feature not enabled for this clinic"));
      }

      // F-A93-04: Log 100% of read access for PHI-bearing endpoints.
      // Under Moroccan Law 09-08 (HIPAA-equivalent), access logs for patient
      // data must be fully retained. Non-PHI endpoints (health, docs, features)
      // can be downsampled to reduce volume.
      // DI-HIGH-03: Removed 1% random sampling for PHI endpoints — compliance
      // requires deterministic, complete audit trails for all PHI access.
      if (request.method === "GET") {
        const pathname = request.nextUrl.pathname;
        const isPhiEndpoint =
          /^\/(api\/)?(patient|appointments|booking|prescriptions|consultations|medical|lab)/.test(
            pathname,
          );
        const shouldLog = !isProduction() || isPhiEndpoint;
        if (shouldLog) {
          // INJ-02: Sanitize pathname to prevent log injection via CRLF/tab
          const safePath = pathname.replace(/[\r\n\t]/g, "?");
          logger.info(`API Read Access: ${request.method} ${safePath}`, {
            context: "audit-read",
            userId: profile.id,
            role: profile.role,
            clinicId: profile.clinic_id,
            path: pathname,
            method: request.method,
          });
        }
      }

      const response = await handler(
        request,
        {
          supabase,
          user,
          profile: {
            id: profile.id,
            role: profile.role as UserRole,
            clinic_id: profile.clinic_id ?? null,
          },
        },
        routeCtx,
      );
      return finalize(response);
    } catch (err) {
      logger.error("Authentication failed", { context: "with-auth", error: err });
      return finalize(apiInternalError("Authentication failed"));
    }
  };
}

/**
 * R-04: Wrapper for routes that should allow any authenticated user.
 * This replaces the old withAuth(handler, null) pattern.
 *
 * Usage:
 *   export const POST = withAuthAnyRole(handler);
 */
export function withAuthAnyRole<RouteCtx = unknown>(
  handler: AuthenticatedHandler<RouteCtx>,
  options: WithAuthOptions = {},
) {
  const failOpen = options.failOpen === true;
  return async (request: NextRequest, routeCtx?: RouteCtx): Promise<NextResponse> => {
    const finalize = (response: NextResponse): NextResponse => {
      applyRequestScopedResponseHeaders(request, response);
      if (!response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "private, no-store");
      }
      return response;
    };

    try {
      const result = await resolveAuthProfile(request, "with-auth-any-role", failOpen);

      // resolveAuthProfile returns a NextResponse on any auth/tenant failure.
      if (!("supabase" in result)) return finalize(result);

      const { supabase, user, profile } = result;

      // withAuthAnyRole: no role check — any authenticated user is permitted.
      // AUDIT-24 / S0-07-03: Per-user rate limiting still applies.
      if (!(await perUserLimiter.check(`user:${profile.id}`))) {
        return finalize(apiError("Too many requests. Please slow down.", 429, "USER_RATE_LIMIT"));
      }

      // ADR-0013 / Lane-A: Gate Architecture-B API groups by feature flag.
      let tenantTypeKey: string | undefined;
      try {
        const tenant = await getTenant();
        tenantTypeKey = tenant?.clinicType;
      } catch (tenantErr) {
        logger.warn("Could not resolve tenant for API gate", {
          context: "with-auth-any-role",
          error: tenantErr,
        });
      }
      if (!(await isApiGroupAllowed(supabase, request.nextUrl.pathname, tenantTypeKey))) {
        logger.warn("API route gated by feature flag", {
          context: "with-auth-any-role",
          path: request.nextUrl.pathname,
          userId: profile.id,
          clinicId: profile.clinic_id,
        });
        return finalize(apiForbidden("Feature not enabled for this clinic"));
      }

      const response = await handler(
        request,
        {
          supabase,
          user,
          profile: {
            id: profile.id,
            role: profile.role as UserRole,
            clinic_id: profile.clinic_id ?? null,
          },
        },
        routeCtx,
      );
      return finalize(response);
    } catch (err) {
      logger.error("Authentication failed in withAuthAnyRole", {
        context: "with-auth-any-role",
        error: err,
      });
      return finalize(apiInternalError("Authentication failed"));
    }
  };
}
