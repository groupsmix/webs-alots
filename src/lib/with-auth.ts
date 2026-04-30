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
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { verifyProfileHeader, PROFILE_HEADER_NAMES } from "@/lib/profile-header-hmac";
import { createClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { setTenantContext, logTenantContext } from "@/lib/tenant-context";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database";

// ── AUDIT-24: Per-user rate limiting ─────────────────────────────────
// Lightweight in-memory sliding window per authenticated user ID.
// Supplements the per-IP middleware limits to catch authenticated abuse.
const USER_RATE_WINDOW_MS = 60_000; // 1 minute
const USER_RATE_MAX = 100;          // max requests per window per user
const USER_RATE_MAX_KEYS = 10_000;  // prevent unbounded memory growth

interface UserRateEntry {
  count: number;
  resetAt: number;
}

const userRateBuckets = new Map<string, UserRateEntry>();

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateBuckets.get(userId);

  if (!entry || now > entry.resetAt) {
    // Evict oldest entries if map is too large
    if (userRateBuckets.size >= USER_RATE_MAX_KEYS) {
      const oldest = [...userRateBuckets.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.floor(USER_RATE_MAX_KEYS / 4));
      for (const [key] of oldest) userRateBuckets.delete(key);
    }
    userRateBuckets.set(userId, { count: 1, resetAt: now + USER_RATE_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= USER_RATE_MAX;
}

export interface AuthContext {
  supabase: SupabaseClient<Database>;
  user: User;
  profile: { id: string; role: UserRole; clinic_id: string | null };
}

type AuthenticatedHandler = (
  request: NextRequest,
  auth: AuthContext,
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
export function withAuth(
  handler: AuthenticatedHandler,
  allowedRoles: UserRole[],
  options: WithAuthOptions = {},
) {
  const failOpen = options.failOpen === true;
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 },
        );
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
        logger.warn("Profile headers present but signature could not be verified — falling back to DB", {
          context: "with-auth",
          userId: user.id,
        });
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
        return NextResponse.json(
          { error: "User profile not found" },
          { status: 404 },
        );
      }

      // If specific roles are required, enforce them.
      // R-04: withAuth no longer accepts null for allowedRoles.
      // Use withAuthAnyRole() for any-authenticated behavior.
      if (!allowedRoles.includes(profile.role as UserRole)) {
        return NextResponse.json(
          { error: "Forbidden — insufficient permissions" },
          { status: 403 },
        );
      }

      // F-08: Assert the user's clinic_id matches the subdomain-resolved tenant
      // to prevent cross-tenant access via tampered profile data.
      if (profile.clinic_id && profile.role !== "super_admin") {
        try {
          const tenant = await getTenant();
          if (tenant && profile.clinic_id !== tenant.clinicId) {
            logger.error("Tenant mismatch: profile.clinic_id does not match subdomain tenant", {
              context: "with-auth",
              profileClinicId: profile.clinic_id,
              subdomainClinicId: tenant.clinicId,
              userId: profile.id,
            });
            return NextResponse.json(
              { error: "Forbidden — tenant mismatch" },
              { status: 403 },
            );
          }
        } catch (tenantErr) {
          logger.warn("Could not resolve tenant for assertion", {
            context: "with-auth",
            error: tenantErr,
          });
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
          logger.error("Failed to set tenant context in withAuth", {
            context: "with-auth",
            clinicId: profile.clinic_id,
            failOpen,
            error: tenantErr,
          });
          if (!failOpen) {
            return NextResponse.json(
              { error: "Tenant context unavailable" },
              { status: 503 },
            );
          }
        }
      }

      logTenantContext(profile.clinic_id, "with-auth", {
        userId: profile.id,
        role: profile.role,
      });

      // AUDIT-24: Per-user rate limiting for authenticated API requests.
      // The middleware applies per-IP limits, but authenticated abuse from
      // compromised accounts or distributed IPs requires user-keyed limits.
      // This is a lightweight in-memory check (100 req/min per user) that
      // supplements the IP-based middleware limits.
      if (!checkUserRateLimit(profile.id)) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down.", code: "USER_RATE_LIMIT" },
          { status: 429 },
        );
      }

      // F-13: Downsample per-request API read access log to 1% in production.
      // Full audit trail is still available via audit_log entries for mutations.
      if (request.method === "GET") {
        const shouldLog = process.env.NODE_ENV !== "production" || Math.random() < 0.01;
        if (shouldLog) {
          logger.debug(`API Read Access: ${request.method} ${request.nextUrl.pathname}`, {
            context: "audit-read",
            userId: profile.id,
            role: profile.role,
            clinicId: profile.clinic_id,
            path: request.nextUrl.pathname,
            method: request.method,
          });
        }
      }

      return handler(request, {
        supabase,
        user,
        profile: { id: profile.id, role: profile.role as UserRole, clinic_id: profile.clinic_id ?? null },
      });
    } catch (err) {
      logger.error("Authentication failed", { context: "with-auth", error: err });
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      );
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
export function withAuthAnyRole(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {},
) {
  const failOpen = options.failOpen === true;
  // Pass an empty array to withAuth, then check that the user is authenticated
  // without enforcing any specific role. This is a "deny-by-default with
  // explicit allowlist" pattern - every withAuth call must specify roles.
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 },
        );
      }

      // Check for signed profile headers from middleware
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

      // Mirror withAuth's forgery probe signal: if a signature header was
      // present but verifyProfileHeader rejected it, log a warning so probes
      // with bad signatures still leave a trail. Routes migrated from
      // withAuth(handler, null) to withAuthAnyRole would otherwise lose this.
      if (!profile && request.headers.get(PROFILE_HEADER_NAMES.sig)) {
        logger.warn("Profile headers present but signature could not be verified — falling back to DB", {
          context: "with-auth-any-role",
          userId: user.id,
        });
      }

      if (!profile) {
        const { data: dbProfile } = await supabase
          .from("users")
          .select("id, role, clinic_id")
          .eq("auth_id", user.id)
          .single();
        profile = dbProfile as { id: string; role: UserRole; clinic_id: string | null } | null;
      }

      if (!profile) {
        return NextResponse.json(
          { error: "User profile not found" },
          { status: 404 },
        );
      }

      // F-08: Assert the user's clinic_id matches the subdomain-resolved tenant
      // to prevent cross-tenant access via tampered profile data. This must run
      // for withAuthAnyRole too — without it, routes migrated from
      // withAuth(handler, null) lose the defense-in-depth check.
      if (profile.clinic_id && profile.role !== "super_admin") {
        try {
          const tenant = await getTenant();
          if (tenant && profile.clinic_id !== tenant.clinicId) {
            logger.error("Tenant mismatch: profile.clinic_id does not match subdomain tenant", {
              context: "with-auth-any-role",
              profileClinicId: profile.clinic_id,
              subdomainClinicId: tenant.clinicId,
              userId: profile.id,
            });
            return NextResponse.json(
              { error: "Forbidden — tenant mismatch" },
              { status: 403 },
            );
          }
        } catch (tenantErr) {
          logger.warn("Could not resolve tenant for assertion", {
            context: "with-auth-any-role",
            error: tenantErr,
          });
        }
      }

      // Set tenant context (fail-closed by default — see withAuth above).
      if (profile.clinic_id) {
        try {
          await setTenantContext(supabase, profile.clinic_id);
        } catch (tenantErr) {
          logger.error("Failed to set tenant context in withAuthAnyRole", {
            context: "with-auth",
            clinicId: profile.clinic_id,
            failOpen,
            error: tenantErr,
          });
          if (!failOpen) {
            return NextResponse.json(
              { error: "Tenant context unavailable" },
              { status: 503 },
            );
          }
        }
      }

      logTenantContext(profile.clinic_id, "with-auth-any-role", {
        userId: profile.id,
        role: profile.role,
      });

      return handler(request, {
        supabase,
        user,
        profile: { id: profile.id, role: profile.role as UserRole, clinic_id: profile.clinic_id ?? null },
      });
    } catch (err) {
      logger.error("Authentication failed in withAuthAnyRole", { context: "with-auth", error: err });
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      );
    }
  };
}
