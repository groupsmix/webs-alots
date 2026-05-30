/**
 * GET   /api/admin/team — List super-admin team members (users with admin roles)
 * PATCH /api/admin/team — Update a team member's role or status
 *
 * All endpoints require super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const ADMIN_ROLES = ["super_admin", "clinic_admin"] as const;

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
    // Super-admin views all admin-level users across the platform
    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    const { data, error } = await supabase
      .from("users")
      .select("id, auth_id, name, email, role, clinic_id, created_at")
      .in("role", ADMIN_ROLES)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch team members", {
        context: "team-api",
        error,
      });
      return apiInternalError("Failed to fetch team members");
    }

    // Fetch last sign-in from auth.users for each team member that has an auth_id
    const members = data ?? [];
    const authIds = members.map((m) => m.auth_id).filter(Boolean) as string[];

    const lastSignIns: Record<string, string | null> = {};
    if (authIds.length > 0) {
      const { data: authUsers } = await supabase.auth.admin.listUsers({
        perPage: 100,
      });
      if (authUsers?.users) {
        for (const au of authUsers.users) {
          lastSignIns[au.id] = au.last_sign_in_at ?? null;
        }
      }
    }

    const enriched = members.map((m) => ({
      ...m,
      last_login: m.auth_id ? (lastSignIns[m.auth_id] ?? null) : null,
    }));

    return apiSuccess({ members: enriched });
  } catch (err) {
    logger.error("Unexpected error fetching team members", {
      context: "team-api",
      error: err,
    });
    return apiInternalError("Failed to fetch team members");
  }
}

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const parsed = body as Record<string, unknown>;
    const userId = typeof parsed.user_id === "string" ? parsed.user_id.trim() : "";
    const action = typeof parsed.action === "string" ? parsed.action : "";

    if (!userId) {
      return apiValidationError("user_id is required");
    }

    // nosemgrep: tenant-scoping
    const supabase = createUntypedAdminClient("super_admin");

    if (action === "update_role") {
      const newRole = typeof parsed.role === "string" ? parsed.role : "";
      if (!ADMIN_ROLES.includes(newRole as (typeof ADMIN_ROLES)[number])) {
        return apiValidationError(`role must be one of: ${ADMIN_ROLES.join(", ")}`);
      }

      const { error } = await supabase.from("users").update({ role: newRole }).eq("id", userId);

      if (error) {
        logger.error("Failed to update team member role", { context: "team-api", error });
        return apiInternalError("Failed to update role");
      }

      await logAuditEvent({
        supabase: auth.supabase,
        action: "team.role_updated",
        type: "admin",
        actor: auth.profile.id,
        clinicId: "system",
        description: `Updated team member role to ${newRole}`,
        metadata: { userId, newRole },
      });

      return apiSuccess({ updated: true });
    }

    if (action === "remove") {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", userId)
        .in("role", ADMIN_ROLES);

      if (error) {
        logger.error("Failed to remove team member", { context: "team-api", error });
        return apiInternalError("Failed to remove team member");
      }

      await logAuditEvent({
        supabase: auth.supabase,
        action: "team.member_removed",
        type: "admin",
        actor: auth.profile.id,
        clinicId: "system",
        description: `Removed team member`,
        metadata: { userId },
      });

      return apiSuccess({ removed: true });
    }

    return apiError("Unknown action", 400);
  } catch (err) {
    logger.error("Unexpected error updating team member", {
      context: "team-api",
      error: err,
    });
    return apiInternalError("Failed to update team member");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
