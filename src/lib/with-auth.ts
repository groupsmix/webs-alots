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
 *                       Pass `null` to skip role checking (auth-only).
 */
export function withAuth(
  handler: AuthenticatedHandler,
  allowedRoles: UserRole[] | null,
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

      // Check for signed profile headers from middleware to avoid double-querying (Audit P1 #8)
      const headerProfileId = request.headers.get("x-auth-profile-id");
      const headerProfileRole = request.headers.get("x-auth-profile-role");
      const headerProfileClinic = request.headers.get("x-auth-profile-clinic") || null;
      const headerProfileSig = request.headers.get("x-auth-profile-sig");

      let profile: { id: string; role: UserRole; clinic_id: string | null } | null = null;

      if (headerProfileId && headerProfileRole && headerProfileSig) {
        // Verify HMAC signature
        const hmacData = `${headerProfileId}:${headerProfileRole}:${headerProfileClinic ?? ""}`;
        const hmacKey = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(process.env.CRON_SECRET || "fallback_secret_key"),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const expectedSig = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(hmacData));
        const expectedSigHex = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (expectedSigHex === headerProfileSig) {
          profile = {
            id: headerProfileId,
            role: headerProfileRole as UserRole,
            clinic_id: headerProfileClinic
          };
        } else {
          logger.warn("Invalid profile signature in headers, falling back to DB", { context: "with-auth", userId: user.id });
        }
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
      // Passing `null` skips role checking (any authenticated user is
      // allowed).  This is discouraged — prefer an explicit role list
      // to follow deny-by-default.
      if (allowedRoles === null) {
        // No explicit role restriction — any authenticated user is allowed
      } else if (!allowedRoles.includes(profile.role as UserRole)) {
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
