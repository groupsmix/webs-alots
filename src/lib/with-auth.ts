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

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { User } from "@supabase/supabase-js";

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

      // Always fetch the real profile from the database
      const { data: profile } = await supabase
        .from("users")
        .select("id, role, clinic_id")
        .eq("auth_id", user.id)
        .single();

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

      return handler(request, {
        supabase,
        user,
        profile: { id: profile.id, role: profile.role as UserRole, clinic_id: profile.clinic_id ?? null },
      });
    } catch (err) {
      void err;
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      );
    }
  };
}
