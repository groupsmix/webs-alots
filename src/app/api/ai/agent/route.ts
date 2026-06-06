import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { incrementAgentTokenUsage, saveAgentConversationTurn } from "@/lib/ai/chat-history";
import {
  getAgentSystemPrompt,
  SITE_TEAM_AGENT_TYPES,
  type SiteTeamAgentType,
} from "@/lib/ai/prompts";
import { createPseudonymMap, depseudonymise, pseudonymise } from "@/lib/ai/pseudonymise";
import { routeAIRequest, loadProviderConfigs, AllProvidersFailedError } from "@/lib/ai/router";
import { sanitizeUntrustedText } from "@/lib/ai/sanitize";
import { executeAgentTool, getAgentTools } from "@/lib/ai/tools";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { apiError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { aiClinicCeilingLimiter, aiManagerLimiter } from "@/lib/rate-limit";
import {
  createScopedAdminClient,
  createTenantClient,
  createUntypedAdminClient,
} from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { isValidClinicId } from "@/lib/tenant-context";
import type { UserRole } from "@/lib/types/database";
import { withAuthAnyRole, type AuthContext } from "@/lib/with-auth";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const agentRequestSchema = z.object({
  agentType: z.enum(SITE_TEAM_AGENT_TYPES as [SiteTeamAgentType, ...SiteTeamAgentType[]]),
  clinicId: z.string().uuid().optional(),
  messages: z.array(messageSchema).min(1).max(20),
  conversationId: z.string().uuid().optional(),
});

type AgentMessage = z.infer<typeof messageSchema>;

type ToolPlan = { toolName: string | null; input: Record<string, unknown> };

const ROLE_TO_AGENT: Record<UserRole, SiteTeamAgentType> = {
  super_admin: "super_admin",
  clinic_admin: "clinic_admin",
  receptionist: "secretary",
  doctor: "doctor",
  patient: "patient",
};

function streamText(text: string, conversationId?: string | null): NextResponse {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,80}(?:\s|$)/g) ?? [text];

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (conversationId) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "meta", conversationId })}\n\n`),
        );
      }
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`),
        );
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function streamError(message: string, status = 500, code = "AI_AGENT_ERROR"): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "error", message, code })}\n\n`),
      );
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new NextResponse(readable, {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function assertAgentAllowed(role: UserRole, agentType: SiteTeamAgentType): boolean {
  const expectedAgent = ROLE_TO_AGENT[role];
  if (expectedAgent === agentType) return true;
  return role === "receptionist" && agentType === "receptionist";
}

function historyToPrompt(messages: AgentMessage[]): string {
  return messages
    .slice(-12)
    .map(
      (message) => `${message.role === "user" ? "Utilisateur" : "Assistant"}: ${message.content}`,
    )
    .join("\n");
}

function isToolPlan(value: unknown, allowedToolNames: Set<string>): value is ToolPlan {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.toolName !== null && typeof candidate.toolName !== "string") return false;
  if (typeof candidate.toolName === "string" && !allowedToolNames.has(candidate.toolName))
    return false;
  if (!candidate.input || typeof candidate.input !== "object" || Array.isArray(candidate.input))
    return false;
  return true;
}

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

async function resolveToolPlan(params: {
  latestMessage: string;
  messages: AgentMessage[];
  agentType: SiteTeamAgentType;
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}): Promise<ToolPlan> {
  const tools = getAgentTools(params.agentType);
  const allowedToolNames = new Set(tools.map((tool) => tool.name));

  if (tools.length === 0) return { toolName: null, input: {} };

  const configs = await loadProviderConfigs(params.supabase);
  const toolPrompt = `${params.systemPrompt}

Tu dois choisir si un outil en lecture seule est nécessaire avant de répondre.
Outils disponibles:
${JSON.stringify(tools, null, 2)}

Conversation récente:
${historyToPrompt(params.messages)}

Dernier message utilisateur:
${params.latestMessage}

Réponds uniquement en JSON strict sous cette forme:
{"toolName":"nom_outil_ou_null","input":{}}
Utilise null si aucun outil n'est nécessaire.`;

  const result = await routeAIRequest(
    {
      task: "reason",
      complexity: "simple",
      prompt: toolPrompt,
      systemPrompt: "Return only strict JSON. Do not include markdown.",
      maxTokens: 300,
      temperature: 0,
      context: "site-team-agent-tool-plan",
    },
    configs,
    params.supabase,
  );

  const parsed = extractJsonObject(result.text);
  if (!isToolPlan(parsed, allowedToolNames)) return { toolName: null, input: {} };
  return parsed;
}

async function handlePost(req: NextRequest, auth: AuthContext): Promise<NextResponse> {
  let parsedBody: z.infer<typeof agentRequestSchema>;
  try {
    const body = await req.json();
    const parsed = agentRequestSchema.safeParse(body);
    if (!parsed.success)
      return apiValidationError(parsed.error.issues[0]?.message ?? "Invalid body");
    parsedBody = parsed.data;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const { agentType, messages, conversationId } = parsedBody;
  const role = auth.profile.role as UserRole;
  if (!assertAgentAllowed(role, agentType)) {
    return apiError("Agent role is not allowed for this user", 403, "AGENT_ROLE_FORBIDDEN");
  }

  const tenant = await getTenant();
  const requestedClinicId = parsedBody.clinicId;
  const clinicId =
    role === "super_admin"
      ? (requestedClinicId ?? tenant?.clinicId ?? null)
      : auth.profile.clinic_id;

  if (role !== "super_admin") {
    if (!clinicId) return apiError("Aucune clinique associée à ce compte", 403, "NO_CLINIC");
    if (requestedClinicId && requestedClinicId !== clinicId) {
      return apiError("Clinic mismatch", 403, "TENANT_MISMATCH");
    }
    if (tenant?.clinicId && tenant.clinicId !== clinicId) {
      return apiError("Tenant mismatch", 403, "TENANT_MISMATCH");
    }
  }

  if (clinicId && !isValidClinicId(clinicId)) {
    return apiValidationError("Invalid clinicId");
  }

  const userLimiterKey = `site-team-agent:${auth.profile.id}`;
  if (!(await aiManagerLimiter.check(userLimiterKey))) {
    return streamError("Limite quotidienne atteinte. Réessayez demain.", 429, "RATE_LIMITED");
  }
  if (clinicId && !(await aiClinicCeilingLimiter.check(`site-team-agent:clinic:${clinicId}`))) {
    return streamError(
      "Limite quotidienne de la clinique atteinte pour les fonctionnalités IA. Réessayez demain.",
      429,
      "RATE_LIMITED",
    );
  }

  const supabase =
    clinicId && role !== "super_admin" ? await createTenantClient(clinicId) : auth.supabase;
  const historySupabase = clinicId ? createScopedAdminClient("ai-route", clinicId) : null;

  const latestMessage = messages[messages.length - 1];
  if (latestMessage.role !== "user") {
    return apiValidationError("Last message must be from the user");
  }

  const latestUserMessage = sanitizeUntrustedText(latestMessage.content);
  const safeMessages: AgentMessage[] = messages.map((message: AgentMessage) => ({
    role: message.role,
    content: sanitizeUntrustedText(message.content),
  }));

  const [{ data: profileRow }, clinicResult] = await Promise.all([
    supabase.from("users").select("id, name, role, clinic_id").eq("id", auth.profile.id).single(),
    clinicId
      ? supabase.from("clinics").select("id, name").eq("id", clinicId).single()
      : Promise.resolve({ data: null }),
  ]);

  const systemPrompt = getAgentSystemPrompt(agentType, {
    clinicId: clinicId ?? undefined,
    userId: auth.user.id,
    userName: profileRow?.name ?? undefined,
    userRole: role,
    clinicName: clinicResult.data?.name ?? tenant?.clinicName ?? undefined,
  });

  try {
    const planningClient =
      historySupabase ?? createUntypedAdminClient("ai-route", clinicId ?? undefined);
    const toolPlan = await resolveToolPlan({
      latestMessage: latestUserMessage,
      messages: safeMessages,
      agentType,
      systemPrompt,
      supabase: planningClient,
    });

    let toolResult: unknown = null;
    if (toolPlan.toolName) {
      toolResult = await executeAgentTool(toolPlan.toolName, toolPlan.input, {
        supabase,
        clinicId,
        userId: auth.user.id,
        profileId: auth.profile.id,
        userRole: role,
        agentType,
      });
    }

    const pseudonymMap = createPseudonymMap();
    const promptToolResult =
      toolResult && typeof toolResult === "object" && !Array.isArray(toolResult)
        ? pseudonymise({ toolResult: toolResult as Record<string, unknown> }, pseudonymMap)
            .toolResult
        : toolResult;

    const configs = await loadProviderConfigs(planningClient);
    const answerPrompt = `${systemPrompt}

Conversation récente:
${historyToPrompt(safeMessages)}

${
  toolPlan.toolName
    ? `Résultat de l'outil ${toolPlan.toolName}:\n${JSON.stringify(promptToolResult, null, 2)}`
    : "Aucun outil n'a été exécuté pour ce tour."
}

Réponds maintenant au dernier message utilisateur de manière concise et utile. Ne mentionne pas les détails internes des outils.`;

    const aiResponse = await routeAIRequest(
      {
        task: "conversation",
        complexity: agentType === "super_admin" ? "complex" : "medium",
        prompt: answerPrompt,
        systemPrompt,
        maxTokens: 1600,
        temperature: 0.3,
        context: "site-team-agent",
      },
      configs,
      planningClient,
    );

    const validatedOutput = validateAIOutput(aiResponse.text);
    const safeOutput = validatedOutput ? depseudonymise(validatedOutput, pseudonymMap) : null;
    if (!safeOutput) {
      return streamError(
        "La réponse IA a été rejetée par le validateur de sécurité.",
        500,
        "AI_OUTPUT_REJECTED",
      );
    }

    let savedConversationId: string | null = null;
    if (historySupabase && clinicId) {
      savedConversationId = await saveAgentConversationTurn({
        supabase: historySupabase,
        conversationId,
        clinicId,
        userId: auth.profile.id,
        agentType,
        userMessage: latestUserMessage,
        assistantMessage: safeOutput,
        toolName: toolPlan.toolName,
        toolResult,
        tokensIn: aiResponse.inputTokens,
        tokensOut: aiResponse.outputTokens,
      });

      await incrementAgentTokenUsage({
        supabase: historySupabase,
        clinicId,
        agentType,
        tokensIn: aiResponse.inputTokens,
        tokensOut: aiResponse.outputTokens,
      });

      void logAuditEvent({
        supabase: auth.supabase,
        action: "site_team_agent_chat",
        type: agentType === "patient" ? "patient" : "admin",
        clinicId,
        actor: auth.profile.id,
        description: "Site team agent chat turn",
        metadata: {
          agentType,
          toolName: toolPlan.toolName,
          provider: aiResponse.provider,
          model: aiResponse.model,
        },
      });
    }

    return streamText(safeOutput, savedConversationId);
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      logger.error("Site team agent providers failed", {
        context: "site-team-agent",
        agentType,
        clinicId,
        errors: err.errors,
      });
      return streamError("Le service IA est temporairement indisponible.", 503, "AI_UNAVAILABLE");
    }

    logger.error("Site team agent request failed", {
      context: "site-team-agent",
      agentType,
      clinicId,
      error: err,
    });
    return streamError("Le service IA est temporairement indisponible. Veuillez réessayer.");
  }
}

export const POST = withAuthAnyRole(handlePost);
