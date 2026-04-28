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
) {
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
      const verified = await verifyProfileHeader({
        id: request.headers.get(PROFILE_HEADER_NAMES.id),
        role: request.headers.get(PROFILE_HEADER_NAMES.role),
        clinic_id: request.headers.get(PROFILE_HEADER_NAMES.clinic),
        signature: request.headers.get(PROFILE_HEADER_NAMES.sig),
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
      if (profile.clinic_id) {
        try {
          await setTenantContext(supabase, profile.clinic_id);
        } catch (tenantErr) {
          logger.error("Failed to set tenant context in withAuth", {
            context: "with-auth",
            clinicId: profile.clinic_id,
            error: tenantErr,
          });
          // Continue — RLS via get_user_clinic_id() still protects
        }
      }

      logTenantContext(profile.clinic_id, "with-auth", {
        userId: profile.id,
        role: profile.role,
      });

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
export function withAuthAnyRole(handler: AuthenticatedHandler) {
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
      const verified = await verifyProfileHeader({
        id: request.headers.get(PROFILE_HEADER_NAMES.id),
        role: request.headers.get(PROFILE_HEADER_NAMES.role),
        clinic_id: request.headers.get(PROFILE_HEADER_NAMES.clinic),
        signature: request.headers.get(PROFILE_HEADER_NAMES.sig),
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

      // Set tenant context
      if (profile.clinic_id) {
        try {
          await setTenantContext(supabase, profile.clinic_id);
        } catch (tenantErr) {
          logger.error("Failed to set tenant context in withAuthAnyRole", {
            context: "with-auth",
            clinicId: profile.clinic_id,
            error: tenantErr,
          });
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
