/**
 * POST /api/super-admin/users/:id/impersonate
 *
 * Starts an impersonation session for the target user.
 * Only enabled when IMPERSONATION_ENABLED=true.
 * Super admin only. Cannot impersonate another super_admin.
 */

import { type NextRequest } from "next/server";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const POST = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) =>
  withAuth(
    async (req: NextRequest, { supabase, user, profile }: AuthContext) => {
      // nosemgrep: semgrep.env-access
      if (process.env.IMPERSONATION_ENABLED !== "true") {
        return apiError("Impersonation is disabled", 403, "IMPERSONATION_DISABLED");
      }

      const { id } = await context.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return apiNotFound();

      // Fetch target user profile — super_admin may read across tenants.
      // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant
      const adminClient = createAdminClient("impersonate");
      const { data: targetUser } = await adminClient
        .from("users")
        .select("id, role, clinic_id")
        .eq("id", id)
        .maybeSingle();

      if (!targetUser) return apiNotFound("User not found");

      if (targetUser.role === "super_admin") {
        return apiError("Cannot impersonate another super_admin", 403, "FORBIDDEN");
      }

      if (!targetUser.clinic_id) {
        return apiError("Target user has no clinic context", 422, "NO_CLINIC");
      }

      // Create a server-side impersonation session (audit finding #6).
      // Uses untyped client because impersonation_sessions is not yet in
      // the generated Database type.
      const untypedClient = createUntypedAdminClient("impersonate");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data: session, error: sessionError } = await untypedClient
        .from("impersonation_sessions")
        .insert({
          actor_id: user.id,
          clinic_id: targetUser.clinic_id,
          reason: "Initiated by super_admin via dashboard",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (sessionError || !session) {
        return apiError("Failed to create impersonation session", 500);
      }

      await logAuditEvent({
        supabase,
        action: "user_impersonation_started",
        type: "security",
        clinicId: targetUser.clinic_id,
        actor: profile.id,
        description: `super_admin ${profile.id} started impersonating user ${id}`,
        metadata: {
          targetUserId: id,
          impersonatorId: user.id,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          sessionId: (session as { id: string }).id,
        },
      });

      // Set httpOnly cookie so the ImpersonationBanner can detect the session.
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.set("impersonator_id", user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60, // 15 minutes — matches session expiry
      });

      return apiSuccess({
        message: "Impersonation session started",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        redirectUrl: `/api/auth/impersonate-callback?session=${(session as { id: string }).id}`,
      });
    },
    ["super_admin"],
  )(request);
