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
import { withAuth, type AuthContext } from "@/lib/with-auth";
import {
  adjustTeamMemberTicketCount,
  ensureInternalTeamMembers,
  pickLeastBusyTeamMember,
  type InternalTeamMember,
  type InternalTeamRole,
} from "@/lib/team-members";
import type { UserRole } from "@/lib/types/database";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const triageSchema = z.object({
  ticket_id: z.string().uuid(),
});

type NormalizedTicket = {
  id: string;
  clinicId: string;
  clinicName: string;
  subject: string;
  description: string;
  currentPriority: string;
  currentCategory: string;
  assignedTeamMemberId: string | null;
};

type TriageDecision = {
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  sentiment: "frustrated" | "neutral" | "satisfied";
  draftResponse: string;
  preferredRoles: InternalTeamRole[];
  reason: string;
};

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeMessageRow(row: Record<string, unknown>) {
  const sender = typeof row.sender_type === "string" ? row.sender_type : "system";
  const senderType =
    sender === "staff"
      ? "admin"
      : sender === "patient"
        ? "clinic"
        : sender === "bot"
          ? "system"
          : sender;

  return {
    senderType,
    message:
      typeof row.message === "string"
        ? row.message
        : typeof row.content === "string"
          ? row.content
          : "",
  };
}

function buildFallbackTriage(ticket: NormalizedTicket, conversationText: string): TriageDecision {
  const normalized = `${ticket.subject}\n${ticket.description}\n${conversationText}`.toLowerCase();

  let category = "general";
  let priority: TriageDecision["priority"] = "medium";
  let sentiment: TriageDecision["sentiment"] = "neutral";
  let preferredRoles: InternalTeamRole[] = ["support_tech", "super_admin"];

  if (/(paiement|payment|billing|invoice|refund|facture|subscription|abonnement)/.test(normalized)) {
    category = "billing";
    preferredRoles = ["billing", "super_admin"];
  } else if (/(onboarding|setup|domain|dns|whatsapp|launch|mise en ligne|subdomain)/.test(normalized)) {
    category = "onboarding";
    preferredRoles = ["account_manager", "super_admin"];
  } else if (/(bug|error|erreur|crash|login|api|sync|import|integration|panne|down)/.test(normalized)) {
    category = "technical";
    preferredRoles = ["support_tech", "developer", "super_admin"];
  } else if (/(formation|training|how to|comment|workflow|staff)/.test(normalized)) {
    category = "training";
    preferredRoles = ["account_manager", "support_tech", "super_admin"];
  }

  if (/(urgent|asap|immediately|bloqu|can't|cannot|impossible|down|panne|critical)/.test(normalized)) {
    priority = "critical";
  } else if (/(high|important|broken|échoue|failed|failure|refund)/.test(normalized)) {
    priority = "high";
  } else if (/(thanks|merci|great|resolved|parfait)/.test(normalized)) {
    priority = "low";
  }

  if (/(frustrated|angry|urgent|unacceptable|blocked|bloqu|panne|impossible)/.test(normalized)) {
    sentiment = "frustrated";
  } else if (/(thanks|merci|perfect|great|resolved)/.test(normalized)) {
    sentiment = "satisfied";
  }

  const draftResponse =
    category === "billing"
      ? "Merci pour votre message. Nous vérifions votre dossier de facturation et revenons vers vous avec une mise à jour claire dans les plus brefs délais."
      : category === "onboarding"
        ? "Merci, nous examinons l'étape d'onboarding bloquante et nous vous envoyons immédiatement la prochaine action recommandée."
        : category === "technical"
          ? "Merci pour le signalement. Notre équipe technique vérifie le problème, sa portée, et vous recontacte avec un plan d'action ou un correctif."
          : "Merci pour votre message. Nous avons bien pris en compte votre demande et nous revenons vers vous rapidement avec la meilleure action suivante.";

  return {
    category,
    priority,
    sentiment,
    draftResponse,
    preferredRoles,
    reason: `Heuristic triage matched category=${category} priority=${priority}`,
  };
}

async function buildAiTriage(
  admin: ReturnType<typeof createUntypedAdminClient>,
  ticket: NormalizedTicket,
  conversationText: string,
  members: InternalTeamMember[],
): Promise<TriageDecision | null> {
  try {
    const configs = await loadProviderConfigs(admin);
    const aiResponse = await routeAIRequest(
      {
        task: "reason",
        complexity: "simple",
        prompt: `Triage ce ticket support interne Oltigo en JSON strict.\n\nTicket:\n${JSON.stringify(
          {
            clinicName: ticket.clinicName,
            subject: ticket.subject,
            description: ticket.description,
            conversation: conversationText,
          },
          null,
          2,
        )}\n\nAgents disponibles:\n${JSON.stringify(
          members.map((member) => ({
            id: member.id,
            name: member.name,
            role: member.role,
            isAvailable: member.is_available,
            currentTicketCount: member.current_ticket_count,
          })),
          null,
          2,
        )}\n\nRéponds uniquement en JSON avec:\n{\n  \"category\": \"billing|technical|onboarding|training|general\",\n  \"priority\": \"critical|high|medium|low\",\n  \"sentiment\": \"frustrated|neutral|satisfied\",\n  \"draftResponse\": \"...\",\n  \"preferredRoles\": [\"support_tech\"],\n  \"reason\": \"...\"\n}`,
        systemPrompt:
          "You are a healthcare SaaS support triage assistant. Use only the provided ticket text. Return strict JSON only.",
        maxTokens: 400,
        temperature: 0.1,
        context: "support-ticket-triage",
      },
      configs,
      admin,
    );

    const parsed = extractJsonObject(aiResponse.text) as Partial<TriageDecision> | null;
    if (!parsed) return null;

    const priority =
      parsed.priority === "critical" ||
      parsed.priority === "high" ||
      parsed.priority === "medium" ||
      parsed.priority === "low"
        ? parsed.priority
        : null;
    const sentiment =
      parsed.sentiment === "frustrated" ||
      parsed.sentiment === "neutral" ||
      parsed.sentiment === "satisfied"
        ? parsed.sentiment
        : null;

    if (!priority || !sentiment || typeof parsed.category !== "string") return null;

    return {
      category: parsed.category,
      priority,
      sentiment,
      draftResponse:
        typeof parsed.draftResponse === "string" && parsed.draftResponse.trim()
          ? parsed.draftResponse.trim()
          : buildFallbackTriage(ticket, conversationText).draftResponse,
      preferredRoles: Array.isArray(parsed.preferredRoles)
        ? parsed.preferredRoles.filter((role): role is InternalTeamRole =>
            ["support_tech", "account_manager", "developer", "billing", "super_admin"].includes(
              String(role),
            ),
          )
        : [],
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "AI triage completed",
    };
  } catch (error) {
    if (!(error instanceof AllProvidersFailedError)) {
      logger.warn("AI triage failed, falling back to heuristics", {
        context: "support-triage",
        ticketId: ticket.id,
        error,
      });
    }
    return null;
  }
}

function mapAiPriorityToHumanPriority(priority: TriageDecision["priority"]): string {
  switch (priority) {
    case "critical":
      return "urgent";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
    default:
      return "low";
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = triageSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError("ticket_id is required");
  }

  const admin = createUntypedAdminClient("super_admin");

  try {
    const { data: ticketRow, error: ticketError } = await admin
      .from("support_tickets")
      .select("*, clinics(name)")
      .eq("id", parsed.data.ticket_id)
      .single();

    if (ticketError || !ticketRow) {
      return apiInternalError("Failed to load support ticket for triage");
    }

    const ticketRecord = ticketRow as Record<string, unknown>;
    const ticket: NormalizedTicket = {
      id: String(ticketRecord.id),
      clinicId: String(ticketRecord.clinic_id),
      clinicName:
        typeof (ticketRecord.clinics as { name?: string } | null)?.name === "string"
          ? ((ticketRecord.clinics as { name?: string }).name as string)
          : "Clinique",
      subject: typeof ticketRecord.subject === "string" ? ticketRecord.subject : "",
      description:
        typeof ticketRecord.description === "string"
          ? ticketRecord.description
          : typeof ticketRecord.metadata === "object" && ticketRecord.metadata && typeof (ticketRecord.metadata as Record<string, unknown>).last_message === "string"
            ? ((ticketRecord.metadata as Record<string, unknown>).last_message as string)
            : "",
      currentPriority: typeof ticketRecord.priority === "string" ? ticketRecord.priority : "medium",
      currentCategory: typeof ticketRecord.category === "string" ? ticketRecord.category : "general",
      assignedTeamMemberId:
        typeof ticketRecord.assigned_team_member_id === "string"
          ? ticketRecord.assigned_team_member_id
          : null,
    };

    const { data: messageRows } = await admin
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const normalizedMessages = ((messageRows ?? []) as Record<string, unknown>[])
      .map(normalizeMessageRow)
      .filter((row) => row.message.length > 0);
    const conversationText = normalizedMessages
      .map((row) => `${row.senderType}: ${row.message}`)
      .join("\n")
      .slice(0, 4000);

    const members = await ensureInternalTeamMembers(admin);
    const fallback = buildFallbackTriage(ticket, conversationText);
    const aiDecision = await buildAiTriage(admin, ticket, conversationText, members);
    const decision = aiDecision ?? fallback;
    const assignee = pickLeastBusyTeamMember(members, decision.preferredRoles);
    const humanPriority = mapAiPriorityToHumanPriority(decision.priority);

    const updatePayload: Record<string, unknown> = {
      ai_priority: decision.priority,
      ai_category: decision.category,
      sentiment: decision.sentiment,
      ai_draft_response: decision.draftResponse,
      triaged_at: new Date().toISOString(),
      priority: humanPriority,
      updated_at: new Date().toISOString(),
      assigned_team_member_id: assignee?.id ?? null,
      assigned_to: assignee?.user_id ?? null,
    };

    const { data: updatedRow, error: updateError } = await admin
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (updateError) {
      logger.error("Failed to persist ticket triage", {
        context: "support-triage",
        ticketId: ticket.id,
        error: updateError.message,
      });
      return apiInternalError("Failed to save support ticket triage");
    }

    if (ticket.assignedTeamMemberId && ticket.assignedTeamMemberId !== assignee?.id) {
      await adjustTeamMemberTicketCount(admin, ticket.assignedTeamMemberId, -1);
    }
    if (assignee && ticket.assignedTeamMemberId !== assignee.id) {
      await adjustTeamMemberTicketCount(admin, assignee.id, 1);
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "support_ticket_triaged",
      type: "admin",
      actor: auth.profile.id,
      clinicId: ticket.clinicId,
      description: `AI triaged support ticket ${ticket.id}`,
      metadata: {
        ticketId: ticket.id,
        aiPriority: decision.priority,
        aiCategory: decision.category,
        assignedTeamMemberId: assignee?.id ?? null,
        reason: decision.reason,
      },
    });

    return apiSuccess({
      ticket: updatedRow,
      triage: {
        ...decision,
        assignedTeamMemberId: assignee?.id ?? null,
        assignedTeamMemberName: assignee?.name ?? null,
      },
    });
  } catch (error) {
    logger.error("Support triage failed", {
      context: "support-triage",
      ticketId: parsed.data.ticket_id,
      error,
    });
    return apiInternalError("Failed to triage support ticket");
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);
