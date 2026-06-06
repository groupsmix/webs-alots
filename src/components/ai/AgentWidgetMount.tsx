import { AgentWidget } from "@/components/ai/AgentWidget";
import type { SiteTeamAgentType } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";

type AgentWidgetMountProps = {
  agentType: SiteTeamAgentType;
  position?: "bottom-right" | "bottom-left" | "sidebar";
};

const ROLE_TO_AGENT: Record<UserRole, SiteTeamAgentType> = {
  super_admin: "super_admin",
  clinic_admin: "clinic_admin",
  receptionist: "secretary",
  doctor: "doctor",
  patient: "patient",
};

function canMountAgent(role: UserRole, agentType: SiteTeamAgentType): boolean {
  const expected = ROLE_TO_AGENT[role];
  if (expected === agentType) return true;
  return role === "receptionist" && agentType === "receptionist";
}

export async function AgentWidgetMount({
  agentType,
  position = "bottom-right",
}: AgentWidgetMountProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, clinic_id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) return null;

  const role = profile.role as UserRole;
  if (!canMountAgent(role, agentType)) return null;

  const tenant = await getTenant();

  if (role !== "super_admin") {
    if (!profile.clinic_id || !tenant?.clinicId) return null;
    if (profile.clinic_id !== tenant.clinicId) return null;
  }

  return (
    <AgentWidget
      agentType={agentType}
      clinicId={tenant?.clinicId ?? profile.clinic_id ?? undefined}
      userId={profile.id}
      clinicName={tenant?.clinicName}
      position={position}
    />
  );
}
