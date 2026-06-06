import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiInternalError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import {
  loadProviderConfigs,
  routeAIRequest,
  AllProvidersFailedError,
} from "@/lib/ai/router";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import {
  ensureInternalTeamMembers,
  labelInternalTeamRole,
  type InternalTeamMember,
} from "@/lib/team-members";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const mutationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  team_member_id: z.string().uuid().optional(),
  refresh: z.boolean().optional().default(false),
});

type BriefingEntry = {
  teamMemberId: string;
  name: string;
  role: string;
  isAvailable: boolean;
  currentTicketCount: number;
  openTickets: number;
  urgentTickets: number;
  stalledOnboardings: number;
  unreadAlerts: number;
  briefing: string | null;
  generatedAt: string | null;
};

type WorkloadSnapshot = {
  openTickets: number;
  urgentTickets: number;
  stalledOnboardings: number;
  unreadAlerts: number;
};

function getDate(value?: string): string {
  return value ?? new Date().toISOString().slice(0, 10);
}

async function buildSnapshot(
  admin: ReturnType<typeof createUntypedAdminClient>,
  member: InternalTeamMember,
): Promise<WorkloadSnapshot> {
  const [openTicketsResult, urgentTicketsResult, stalledResult, alertsResult] = await Promise.all([
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("assigned_team_member_id", member.id)
      .in("status", ["open", "in_progress"]),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("assigned_team_member_id", member.id)
      .in("status", ["open", "in_progress"])
      .in("ai_priority", ["critical", "high"]),
    admin
      .from("clinic_onboardings")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"])
      .lt("step_entered_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
    admin.from("platform_alerts").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);

  return {
    openTickets: openTicketsResult.count ?? 0,
    urgentTickets: urgentTicketsResult.count ?? 0,
    stalledOnboardings: stalledResult.count ?? 0,
    unreadAlerts: alertsResult.count ?? 0,
  };
}

function buildFallbackBriefing(member: InternalTeamMember, date: string, snapshot: WorkloadSnapshot): string {
  const lines = [
    `Bonjour ${member.name}, briefing du ${date}.`,
    `Vous avez ${snapshot.openTickets} ticket(s) ouverts ou en cours, dont ${snapshot.urgentTickets} urgent(s).`,
    `La plateforme compte ${snapshot.stalledOnboardings} onboarding(s) bloqué(s) et ${snapshot.unreadAlerts} alerte(s) non lue(s).`,
  ];

  if (snapshot.urgentTickets > 0) {
    lines.push("Priorité: traiter les tickets urgents avant toute autre tâche planifiée.");
  } else if (snapshot.stalledOnboardings > 0) {
    lines.push("Priorité: suivre les onboardings en attente et sécuriser les cliniques proches du go-live.");
  } else {
    lines.push("Priorité: vérifier les tickets récents, les escalades et les signaux de risque plateforme.");
  }

  lines.push(`Rôle attendu aujourd'hui: ${labelInternalTeamRole(member.role)}.`);
  return lines.join("\n");
}

async function generateBriefing(
  admin: ReturnType<typeof createUntypedAdminClient>,
  member: InternalTeamMember,
  date: string,
  snapshot: WorkloadSnapshot,
): Promise<string> {
  const fallback = buildFallbackBriefing(member, date, snapshot);

  try {
    const configs = await loadProviderConfigs(admin);
    const aiResponse = await routeAIRequest(
      {
        task: "summarize",
        complexity: "simple",
        prompt: `Rédige un briefing matinal concis en français pour un membre de l'équipe Oltigo.\n\nMembre:\n${JSON.stringify(
          {
            name: member.name,
            role: member.role,
            isAvailable: member.is_available,
            currentTicketCount: member.current_ticket_count,
            date,
          },
          null,
          2,
        )}\n\nCharge du jour:\n${JSON.stringify(snapshot, null, 2)}\n\nFormat attendu: 4 à 6 lignes max, orientées action, sans PHI.`,
        systemPrompt:
          "You are a healthcare SaaS operations assistant. Use only supplied aggregate data. Respond in French.",
        maxTokens: 260,
        temperature: 0.2,
        context: "team-morning-briefing",
      },
      configs,
      admin,
    );

    return aiResponse.text.trim() || fallback;
  } catch (error) {
    if (!(error instanceof AllProvidersFailedError)) {
      logger.warn("AI team briefing failed, using fallback", {
        context: "team-briefings",
        teamMemberId: member.id,
        error,
      });
    }
    return fallback;
  }
}

async function loadEntries(
  admin: ReturnType<typeof createUntypedAdminClient>,
  date: string,
  teamMemberId?: string,
): Promise<BriefingEntry[]> {
  const members = await ensureInternalTeamMembers(admin);
  const filteredMembers = teamMemberId ? members.filter((member) => member.id === teamMemberId) : members;

  const { data: briefingRows } = await admin
    .from("team_briefings")
    .select("team_member_id, content, generated_at")
    .eq("briefing_date", date);

  const briefingsByMemberId = new Map(
    ((briefingRows ?? []) as Array<{ team_member_id: string; content: string; generated_at: string }>).map(
      (row) => [row.team_member_id, row],
    ),
  );

  const entries = await Promise.all(
    filteredMembers.map(async (member) => {
      const snapshot = await buildSnapshot(admin, member);
      const briefing = briefingsByMemberId.get(member.id);
      return {
        teamMemberId: member.id,
        name: member.name,
        role: member.role,
        isAvailable: member.is_available,
        currentTicketCount: member.current_ticket_count,
        openTickets: snapshot.openTickets,
        urgentTickets: snapshot.urgentTickets,
        stalledOnboardings: snapshot.stalledOnboardings,
        unreadAlerts: snapshot.unreadAlerts,
        briefing: briefing?.content ?? null,
        generatedAt: briefing?.generated_at ?? null,
      } satisfies BriefingEntry;
    }),
  );

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function handleGet(request: NextRequest, _auth: AuthContext) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ date: searchParams.get("date") ?? undefined });
  if (!parsed.success) {
    return apiValidationError("Invalid date query parameter");
  }

  const admin = createUntypedAdminClient("super_admin");

  try {
    const date = getDate(parsed.data.date);
    const entries = await loadEntries(admin, date);
    return apiSuccess({ date, entries });
  } catch (error) {
    logger.error("Failed to load team briefings", {
      context: "team-briefings",
      error,
    });
    return apiInternalError("Failed to load team briefings");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError("Invalid team briefing request");
  }

  const admin = createUntypedAdminClient("super_admin");
  const date = getDate(parsed.data.date);

  try {
    const members = await ensureInternalTeamMembers(admin);
    const targetMembers = parsed.data.team_member_id
      ? members.filter((member) => member.id === parsed.data.team_member_id)
      : members;

    for (const member of targetMembers) {
      if (!parsed.data.refresh) {
        const { data: existing } = await admin
          .from("team_briefings")
          .select("id")
          .eq("team_member_id", member.id)
          .eq("briefing_date", date)
          .maybeSingle();
        if (existing) continue;
      }

      const snapshot = await buildSnapshot(admin, member);
      const content = await generateBriefing(admin, member, date, snapshot);

      const { error: upsertError } = await admin.from("team_briefings").upsert(
        {
          team_member_id: member.id,
          briefing_date: date,
          content,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "team_member_id,briefing_date" },
      );

      if (upsertError) {
        logger.warn("Failed to upsert team briefing", {
          context: "team-briefings",
          teamMemberId: member.id,
          error: upsertError.message,
        });
      }
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "team_briefings_generated",
      type: "admin",
      actor: auth.profile.id,
      clinicId: "system",
      description: `Generated internal team briefings for ${date}`,
      metadata: {
        date,
        teamMemberId: parsed.data.team_member_id ?? null,
        refresh: parsed.data.refresh,
      },
    });

    const entries = await loadEntries(admin, date, parsed.data.team_member_id);
    return apiSuccess({ date, entries });
  } catch (error) {
    logger.error("Failed to generate team briefings", {
      context: "team-briefings",
      error,
    });
    return apiInternalError("Failed to generate team briefings");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
