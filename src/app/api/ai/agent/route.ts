/**
 * POST /api/ai/agent — Site-team AI agent (Tasks A4 + A5).
 *
 * Task A4: Real end-to-end streaming — tokens stream from provider → SSE →
 * client as they are generated. No more fake setTimeout(8ms) replay.
 *
 * Task A5: Multi-step agent loop — the model can invoke tools across
 * multiple steps (capped at 5), reasoning over tool results before
 * producing a final answer. Replaces the single-shot ToolPlan approach.
 */

import { tool as aiTool } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { incrementAgentTokenUsage, saveAgentConversationTurn } from "@/lib/ai/chat-history";
import { retrieveMemories, formatMemoryBlock } from "@/lib/ai/memory";
import {
  getAgentSystemPrompt,
  SITE_TEAM_AGENT_TYPES,
  type SiteTeamAgentType,
} from "@/lib/ai/prompts";
import { callProviderStream } from "@/lib/ai/providers";
import { createPseudonymMap, depseudonymise } from "@/lib/ai/pseudonymise";
import {
  loadProviderConfigs,
  selectAvailableProvider,
  AllProvidersFailedError,
} from "@/lib/ai/router";
import { sanitizeUntrustedText } from "@/lib/ai/sanitize";
import {
  executeAgentTool,
  getAgentTools,
  type AgentToolContext,
  type AgentToolDefinition,
} from "@/lib/ai/tools";
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

// ── Constants ──

/** Maximum tool execution steps before forcing a final answer (Task A5). */
const MAX_AGENT_STEPS = 5;

/** Maximum total tokens per agent request (hard budget). */
const MAX_REQUEST_TOKENS = 8000;

// ── Request schema ──

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const agentRequestSchema = z.object({
  agentType: z.enum(SITE_TEAM_AGENT_TYPES as [SiteTeamAgentType, ...SiteTeamAgentType[]]),
  // The widget sends `clinicId: null` / `conversationId: null` from its initial
  // React state (a super_admin has no clinic, and there is no conversation yet
  // before the first reply). `JSON.stringify` keeps explicit nulls, so accept
  // null/undefined here and normalise to `undefined` for the handler — using a
  // plain `.optional()` rejected null with "expected string, received null".
  clinicId: z
    .string()
    .uuid()
    .nullish()
    .transform((value) => value ?? undefined),
  messages: z.array(messageSchema).min(1).max(20),
  conversationId: z
    .string()
    .uuid()
    .nullish()
    .transform((value) => value ?? undefined),
});

type AgentMessage = z.infer<typeof messageSchema>;

const ROLE_TO_AGENT: Record<UserRole, SiteTeamAgentType> = {
  super_admin: "super_admin",
  clinic_admin: "clinic_admin",
  receptionist: "secretary",
  doctor: "doctor",
  patient: "patient",
};

// ── SSE helpers ──

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    Connection: "keep-alive",
    "X-Content-Type-Options": "nosniff",
  };
}

function sseChunk(type: string, payload: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

function streamError(message: string, status = 500, code = "AI_AGENT_ERROR"): NextResponse {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseChunk("error", { message, code })));
      controller.enqueue(encoder.encode(sseChunk("done")));
      controller.close();
    },
  });
  return new NextResponse(readable, { status, headers: sseHeaders() });
}

// ── Auth helpers ──

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

type AgentToolSet = Record<string, unknown>;

// ── AI SDK tool conversion (Task A5) ──

/**
 * Convert the existing AgentToolDefinitions to AI SDK `tool()` definitions
 * with zod schemas. The `execute` functions delegate to the existing
 * `executeAgentTool()` so RBAC scoping, read-only guard, and tenant
 * context are unchanged.
 */
function buildSDKTools(toolDefs: AgentToolDefinition[], ctx: AgentToolContext): AgentToolSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const def of toolDefs) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, prop] of Object.entries(def.input_schema.properties)) {
      const p = prop as { type?: string; description?: string; enum?: string[] };
      if (p.enum) {
        shape[key] = z.enum(p.enum as [string, ...string[]]).describe(p.description ?? key);
      } else {
        shape[key] = z.string().describe(p.description ?? key);
      }
    }

    const required = new Set(def.input_schema.required ?? []);
    for (const key of Object.keys(shape)) {
      if (!required.has(key)) {
        shape[key] = shape[key].optional();
      }
    }

    tools[def.name] = aiTool({
      description: def.description,
      inputSchema: z.object(shape),
      execute: async (input: Record<string, unknown>) => {
        const result = await executeAgentTool(def.name, input, ctx);
        return result;
      },
    });
  }

  return tools;
}

// ── Main handler ──

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

  let systemPrompt = getAgentSystemPrompt(agentType, {
    clinicId: clinicId ?? undefined,
    userId: auth.user.id,
    userName: profileRow?.name ?? undefined,
    userRole: role,
    clinicName: clinicResult.data?.name ?? tenant?.clinicName ?? undefined,
  });

  // Phase B3: Inject relevant clinic memories into system prompt
  if (clinicId) {
    try {
      const memClient = createUntypedAdminClient("ai-memory", clinicId);
      const memories = await retrieveMemories(memClient, clinicId, agentType, latestUserMessage);
      const memoryBlock = formatMemoryBlock(memories);
      if (memoryBlock) {
        systemPrompt = `${systemPrompt}\n\n${memoryBlock}`;
      }
    } catch {
      // Memory retrieval failure is non-blocking
    }
  }

  const encoder = new TextEncoder();
  const planningClient =
    historySupabase ?? createUntypedAdminClient("ai-route", clinicId ?? undefined);

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // ── Provider selection ──
        const configs = await loadProviderConfigs(planningClient);
        const provider = selectAvailableProvider(configs);
        if (!provider) {
          controller.enqueue(
            encoder.encode(
              sseChunk("error", {
                message: "Le service IA est temporairement indisponible.",
                code: "AI_UNAVAILABLE",
              }),
            ),
          );
          controller.enqueue(encoder.encode(sseChunk("done")));
          controller.close();
          return;
        }

        const config = configs.get(provider);
        const apiKey = provider === "workers_ai" ? null : (config?.apiKey ?? null);

        // ── Build pseudonym map ──
        const pseudonymMap = createPseudonymMap();

        // ── Build conversation prompt ──
        const conversationContext = historyToPrompt(safeMessages);
        const prompt = `${conversationContext}\n\nUtilisateur: ${latestUserMessage}`;

        // ── Build AI SDK tools (Task A5) ──
        const agentToolDefs = getAgentTools(agentType);
        const toolCtx: AgentToolContext = {
          supabase,
          clinicId,
          userId: auth.user.id,
          profileId: auth.profile.id,
          userRole: role,
          agentType,
        };
        const sdkTools =
          agentToolDefs.length > 0 ? buildSDKTools(agentToolDefs, toolCtx) : undefined;

        // ── Emit meta event ──
        if (conversationId) {
          controller.enqueue(encoder.encode(sseChunk("meta", { conversationId })));
        }

        // ── Stream with multi-step tool loop (Task A4 + A5) ──
        const streamResult = callProviderStream(
          provider,
          {
            task: "conversation",
            complexity: agentType === "super_admin" ? "complex" : "medium",
            prompt,
            systemPrompt,
            maxTokens: MAX_REQUEST_TOKENS,
            temperature: 0.3,
            context: "site-team-agent",
          },
          apiKey,
          sdkTools ? { tools: sdkTools, maxSteps: MAX_AGENT_STEPS } : undefined,
        );

        let fullContent = "";
        let stepIndex = 0;

        // Stream text and tool events to client
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const chunk of (streamResult.raw as any).fullStream) {
          if (chunk.type === "text-delta") {
            fullContent += chunk.text;
            controller.enqueue(encoder.encode(sseChunk("text", { content: chunk.text })));
          } else if (chunk.type === "tool-call") {
            stepIndex++;
            controller.enqueue(
              encoder.encode(
                sseChunk("tool_call", {
                  name: chunk.toolName,
                  step: stepIndex,
                }),
              ),
            );

            // Per-step audit log (Task A5)
            if (clinicId) {
              void logAuditEvent({
                supabase: auth.supabase,
                action: "site_team_agent_tool_step",
                type: agentType === "patient" ? "patient" : "admin",
                clinicId,
                actor: auth.profile.id,
                description: `Agent tool step ${stepIndex}: ${chunk.toolName}`,
                metadata: {
                  agentType,
                  toolName: chunk.toolName,
                  step: stepIndex,
                  provider,
                },
              });
            }
          } else if (chunk.type === "tool-result") {
            const output = chunk.output as Record<string, unknown> | null;
            controller.enqueue(
              encoder.encode(
                sseChunk("tool_call", {
                  name: chunk.toolName,
                  step: stepIndex,
                  resultSummary:
                    output && typeof output === "object" && "ok" in output
                      ? output.ok
                        ? "success"
                        : "error"
                      : "completed",
                }),
              ),
            );
          }
        }

        // ── Output validation ──
        const validatedOutput = validateAIOutput(fullContent);
        const safeOutput = validatedOutput ? depseudonymise(validatedOutput, pseudonymMap) : null;

        if (!safeOutput) {
          controller.enqueue(
            encoder.encode(
              sseChunk("error", {
                message: "La réponse IA a été rejetée par le validateur de sécurité.",
                code: "AI_OUTPUT_REJECTED",
              }),
            ),
          );
          controller.enqueue(encoder.encode(sseChunk("done")));
          controller.close();
          return;
        }

        // ── Usage tracking ──
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        try {
          const usage = await streamResult.usage;
          totalInputTokens = usage.inputTokens;
          totalOutputTokens = usage.outputTokens;
        } catch {
          // Usage not available — estimate from content length
          totalInputTokens = Math.ceil(prompt.length / 4);
          totalOutputTokens = Math.ceil(fullContent.length / 4);
        }

        // ── Persist conversation ──
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
            toolName: stepIndex > 0 ? `multi-step(${stepIndex})` : null,
            toolResult: null,
            tokensIn: totalInputTokens,
            tokensOut: totalOutputTokens,
          });

          await incrementAgentTokenUsage({
            supabase: historySupabase,
            clinicId,
            agentType,
            tokensIn: totalInputTokens,
            tokensOut: totalOutputTokens,
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
              toolSteps: stepIndex,
              provider,
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
            },
          });
        }

        // Emit savedConversationId if we got one
        if (savedConversationId && !conversationId) {
          controller.enqueue(
            encoder.encode(sseChunk("meta", { conversationId: savedConversationId })),
          );
        }

        controller.enqueue(encoder.encode(sseChunk("done")));
        controller.close();
      } catch (err) {
        if (err instanceof AllProvidersFailedError) {
          logger.error("Site team agent providers failed", {
            context: "site-team-agent",
            agentType,
            clinicId,
            errors: err.errors,
          });
        } else {
          logger.error("Site team agent request failed", {
            context: "site-team-agent",
            agentType,
            clinicId,
            error: err,
          });
        }

        try {
          controller.enqueue(
            encoder.encode(
              sseChunk("error", {
                message: "Le service IA est temporairement indisponible. Veuillez réessayer.",
                code: "AI_UNAVAILABLE",
              }),
            ),
          );
          controller.enqueue(encoder.encode(sseChunk("done")));
          controller.close();
        } catch {
          // Stream already closed
        }
      }
    },
  });

  return new NextResponse(readable, { headers: sseHeaders() });
}

export const POST = withAuthAnyRole(handlePost);
