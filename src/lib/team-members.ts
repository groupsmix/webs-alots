import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export type InternalTeamRole =
  | "support_tech"
  | "account_manager"
  | "developer"
  | "billing"
  | "super_admin";

export interface InternalTeamMember {
  id: string;
  user_id: string | null;
  name: string;
  role: InternalTeamRole;
  is_available: boolean;
  current_ticket_count: number;
  created_at?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentional escape hatch: team_members / users tables read here are not part of the generated Database type.
type UntypedSupabase = SupabaseClient<any, any, any>;

function teamMembersTable(supabase: SupabaseClient) {
  return (supabase as UntypedSupabase).from("team_members");
}

function usersTable(supabase: SupabaseClient) {
  return (supabase as UntypedSupabase).from("users");
}

export async function ensureInternalTeamMembers(
  supabase: SupabaseClient,
): Promise<InternalTeamMember[]> {
  const teamTable = teamMembersTable(supabase);
  const { data: existingRows, error: existingError } = await teamTable.select(
    "id, user_id, name, role, is_available, current_ticket_count, created_at",
  );

  if (existingError) {
    logger.warn("Failed to load internal team members", {
      context: "team-members",
      error: existingError.message,
    });
    return [];
  }

  const existing = ((existingRows ?? []) as InternalTeamMember[]).filter(
    (row) => row.role === "super_admin",
  );
  const existingByUserId = new Map(existing.map((row) => [row.user_id, row]));

  const { data: superAdmins, error: usersError } = await usersTable(supabase)
    .select("auth_id, name")
    .eq("role", "super_admin")
    .not("auth_id", "is", null);

  if (usersError) {
    logger.warn("Failed to load super admins for team sync", {
      context: "team-members",
      error: usersError.message,
    });
    return existing;
  }

  const missing = ((superAdmins ?? []) as Array<{ auth_id: string | null; name: string | null }>)
    .filter((row) => row.auth_id && !existingByUserId.has(row.auth_id))
    .map((row) => ({
      user_id: row.auth_id,
      name: row.name?.trim() || "Super Admin",
      role: "super_admin" as const,
      is_available: true,
      current_ticket_count: 0,
    }));

  if (missing.length > 0) {
    const { error: insertError } = await teamTable.insert(missing);
    if (insertError) {
      logger.warn("Failed to backfill internal team members", {
        context: "team-members",
        error: insertError.message,
      });
    }
  }

  const { data: syncedRows, error: syncedError } = await teamTable.select(
    "id, user_id, name, role, is_available, current_ticket_count, created_at",
  );

  if (syncedError) {
    logger.warn("Failed to reload synced internal team members", {
      context: "team-members",
      error: syncedError.message,
    });
    return existing;
  }

  return (syncedRows ?? []) as InternalTeamMember[];
}

export function pickLeastBusyTeamMember(
  members: InternalTeamMember[],
  preferredRoles: InternalTeamRole[] = [],
): InternalTeamMember | null {
  const available = members.filter((member) => member.is_available);
  if (available.length === 0) return null;

  const roleMatched =
    preferredRoles.length > 0
      ? available.filter((member) => preferredRoles.includes(member.role))
      : available;

  const pool = roleMatched.length > 0 ? roleMatched : available;
  return (
    [...pool].sort(
      (a, b) => a.current_ticket_count - b.current_ticket_count || a.name.localeCompare(b.name),
    )[0] ?? null
  );
}

export async function adjustTeamMemberTicketCount(
  supabase: SupabaseClient,
  teamMemberId: string | null | undefined,
  delta: number,
): Promise<void> {
  if (!teamMemberId || !Number.isFinite(delta) || delta === 0) return;

  const table = teamMembersTable(supabase);
  const { data, error } = await table
    .select("id, current_ticket_count")
    .eq("id", teamMemberId)
    .maybeSingle();

  if (error) {
    logger.warn("Failed to load team member ticket count", {
      context: "team-members",
      teamMemberId,
      error: error.message,
    });
    return;
  }

  const current = Number(
    (data as { current_ticket_count?: number | null } | null)?.current_ticket_count ?? 0,
  );
  const next = Math.max(0, current + delta);

  const { error: updateError } = await table
    .update({ current_ticket_count: next })
    .eq("id", teamMemberId);

  if (updateError) {
    logger.warn("Failed to update team member ticket count", {
      context: "team-members",
      teamMemberId,
      error: updateError.message,
    });
  }
}

export function labelInternalTeamRole(role: InternalTeamRole): string {
  switch (role) {
    case "support_tech":
      return "Support technique";
    case "account_manager":
      return "Account manager";
    case "developer":
      return "Développeur";
    case "billing":
      return "Billing";
    case "super_admin":
    default:
      return "Super Admin";
  }
}
