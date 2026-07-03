/**
 * GET   /api/admin/team — List super-admin team members (users with admin roles)
 * PATCH /api/admin/team — Invite, update a team member's role, or remove them
 *
 * All endpoints require super_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createAdminClient, createUntypedAdminClient } from "@/lib/supabase-server";
import { ensureInternalTeamMembers } from "@/lib/team-members";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];
const ADMIN_ROLES = ["super_admin", "clinic_admin"] as const;

type AdminRole = (typeof ADMIN_ROLES)[number];

async function handleGet(_request: NextRequest, _auth: AuthContext) {
  try {
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

    const members = (data ?? []) as Array<{
      id: string;
      auth_id: string | null;
      name: string;
      email: string | null;
      role: AdminRole;
      clinic_id: string | null;
      created_at: string | null;
    }>;

    const authIds = members.map((member) => member.auth_id).filter(Boolean) as string[];
    const lastSignIns: Record<string, string | null> = {};

    if (authIds.length > 0) {
      const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 100 });
      if (authUsers?.users) {
        for (const authUser of authUsers.users) {
          lastSignIns[authUser.id] = authUser.last_sign_in_at ?? null;
        }
      }
    }

    const enriched = members.map((member) => ({
      ...member,
      last_login: member.auth_id ? (lastSignIns[member.auth_id] ?? null) : null,
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

async function inviteTeamMember(parsed: Record<string, unknown>, auth: AuthContext) {
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
  const role = typeof parsed.role === "string" ? parsed.role : "";

  if (!name) return apiValidationError("name is required");
  if (!email) return apiValidationError("email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiValidationError("A valid email is required");
  }
  if (!ADMIN_ROLES.includes(role as AdminRole)) {
    return apiValidationError(`role must be one of: ${ADMIN_ROLES.join(", ")}`);
  }

  const supabase = createUntypedAdminClient("super_admin");
  const adminClient = createAdminClient("super_admin");

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return apiError("A team member with this email already exists", 409, "TEAM_MEMBER_EXISTS");
  }

  let authId: string | null = null;
  try {
    const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8);
    const { data: createdAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        must_change_password: true,
      },
    });

    if (authError) {
      logger.warn("Failed to create auth user for invited team member", {
        context: "team-api",
        email,
        error: authError.message,
      });
    } else {
      authId = createdAuthUser.user?.id ?? null;
    }
  } catch (error) {
    logger.warn("Unexpected auth error inviting team member", {
      context: "team-api",
      email,
      error,
    });
  }

  const { data: createdUser, error: insertError } = await supabase
    .from("users")
    .insert({
      auth_id: authId,
      clinic_id: null,
      role,
      name,
      email,
      phone: null,
    })
    .select("id, auth_id, name, email, role, clinic_id, created_at")
    .single();

  if (insertError) {
    logger.error("Failed to create invited team member row", {
      context: "team-api",
      email,
      error: insertError,
    });
    return apiInternalError("Failed to create team member");
  }

  if (role === "super_admin") {
    await ensureInternalTeamMembers(supabase);
  }

  await logAuditEvent({
    supabase: auth.supabase,
    action: "team.member_invited",
    type: "admin",
    actor: auth.profile.id,
    clinicId: "system",
    description: `Invited team member ${email}`,
    metadata: { userId: createdUser.id, email, role },
  });

  return apiSuccess({ member: createdUser }, 201);
}

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const patchSchema = z.object({
      action: z.string().min(1, "action is required"),
      user_id: z.string().optional(),
      role: z.string().optional(),
      email: z.string().email("A valid email is required").optional(),
      name: z.string().optional(),
    });

    const parsedResult = patchSchema.safeParse(body);
    if (!parsedResult.success) {
      return apiValidationError(parsedResult.error.issues[0].message);
    }
    const parsed = parsedResult.data as Record<string, unknown>;
    const action = parsedResult.data.action;

    if (action === "invite") {
      return inviteTeamMember(parsed, auth);
    }

    const userId = typeof parsed.user_id === "string" ? parsed.user_id.trim() : "";
    if (!userId) {
      return apiValidationError("user_id is required");
    }

    const supabase = createUntypedAdminClient("super_admin");

    if (action === "update_role") {
      const newRole = typeof parsed.role === "string" ? parsed.role : "";
      if (!ADMIN_ROLES.includes(newRole as AdminRole)) {
        return apiValidationError(`role must be one of: ${ADMIN_ROLES.join(", ")}`);
      }

      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId)
        .select("id, auth_id, role")
        .single();

      if (error) {
        logger.error("Failed to update team member role", { context: "team-api", error });
        return apiInternalError("Failed to update role");
      }

      if (newRole === "super_admin") {
        await ensureInternalTeamMembers(supabase);
      }

      await logAuditEvent({
        supabase: auth.supabase,
        action: "team.role_updated",
        type: "admin",
        actor: auth.profile.id,
        clinicId: "system",
        description: `Updated team member role to ${newRole}`,
        metadata: { userId, authId: updatedUser.auth_id ?? null, newRole },
      });

      return apiSuccess({ updated: true });
    }

    if (action === "remove") {
      const { data: existingUser } = await supabase
        .from("users")
        .select("auth_id, role")
        .eq("id", userId)
        .in("role", ADMIN_ROLES)
        .maybeSingle();

      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", userId)
        .in("role", ADMIN_ROLES);

      if (error) {
        logger.error("Failed to remove team member", { context: "team-api", error });
        return apiInternalError("Failed to remove team member");
      }

      if (existingUser?.auth_id) {
        await supabase.from("team_members").delete().eq("user_id", existingUser.auth_id);
      }

      await logAuditEvent({
        supabase: auth.supabase,
        action: "team.member_removed",
        type: "admin",
        actor: auth.profile.id,
        clinicId: "system",
        description: "Removed team member",
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
