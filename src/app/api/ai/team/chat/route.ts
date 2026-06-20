/**
 * POST /api/ai/team/chat
 *
 * Chat with an individual AI team agent (marketing, support, or reminder).
 * Uses the same AI config as the existing AI Manager.
 */

import { type NextRequest } from "next/server";
import { fetchWithAICircuitBreaker } from "@/lib/ai/circuit-breaker";
import { resolveAIConfig } from "@/lib/ai/config";
import { sanitizeUntrustedText } from "@/lib/ai/sanitize";
import {
  fetchMarketingData,
  fetchSupportData,
  fetchReminderData,
  buildMarketingDataContext,
  buildSupportDataContext,
  buildReminderDataContext,
} from "@/lib/ai/team-data";
import {
  buildMarketingAgentPrompt,
  buildSupportAgentPrompt,
  buildReminderAgentPrompt,
} from "@/lib/ai/team-prompts";
import { validateAIOutput } from "@/lib/ai/validate-output";
import { getAIDisclaimer } from "@/lib/ai-disclaimer";
import { apiSuccess, apiError, apiRateLimited, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { aiClinicCeilingLimiter, aiManagerLimiter } from "@/lib/rate-limit";
import type { AIAgentType } from "@/lib/validations/ai-team";
import { aiTeamChatSchema } from "@/lib/validations/ai-team";
import type { AuthContext } from "@/lib/with-auth";

function getSystemPrompt(agentType: AIAgentType): string {
  switch (agentType) {
    case "marketing":
      return buildMarketingAgentPrompt();
    case "support":
      return buildSupportAgentPrompt();
    case "reminder":
      return buildReminderAgentPrompt();
  }
}

async function fetchAgentData(
  supabase: AuthContext["supabase"],
  clinicId: string,
  agentType: AIAgentType,
): Promise<string> {
  switch (agentType) {
    case "marketing": {
      const data = await fetchMarketingData(supabase, clinicId);
      return buildMarketingDataContext(data);
    }
    case "support": {
      const data = await fetchSupportData(supabase, clinicId);
      return buildSupportDataContext(data);
    }
    case "reminder": {
      const data = await fetchReminderData(supabase, clinicId);
      return buildReminderDataContext(data);
    }
  }
}

interface AgentResponse {
  answer: string;
  tasks?: { title: string; description: string; priority: string; dueDate?: string }[];
  alerts?: { title: string; message: string; severity: string }[];
  suggestions?: string[];
}

function parseAgentResponse(content: string): AgentResponse | null {
  try {
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (typeof parsed.answer !== "string" || parsed.answer.trim().length === 0) {
      return null;
    }

    return {
      answer: parsed.answer,
      tasks: Array.isArray(parsed.tasks)
        ? (parsed.tasks as Record<string, unknown>[])
            .filter((t) => typeof t.title === "string" && typeof t.description === "string")
            .map((t) => ({
              title: String(t.title),
              description: String(t.description),
              priority: typeof t.priority === "string" ? t.priority : "medium",
              dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
            }))
        : [],
      alerts: Array.isArray(parsed.alerts)
        ? (parsed.alerts as Record<string, unknown>[])
            .filter((a) => typeof a.title === "string" && typeof a.message === "string")
            .map((a) => ({
              title: String(a.title),
              message: String(a.message),
              severity: typeof a.severity === "string" ? a.severity : "info",
            }))
        : [],
      suggestions: Array.isArray(parsed.suggestions)
        ? (parsed.suggestions as unknown[]).filter((s): s is string => typeof s === "string")
        : [],
    };
  } catch {
    logger.warn("Failed to parse AI agent response", {
      context: "ai-team-chat",
      contentPreview: content.slice(0, 200),
    });
    return null;
  }
}

export const POST = withAuthValidation(
  aiTeamChatSchema,
  async (data, _request: NextRequest, auth) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const userId = profile.id;

    if (!clinicId) {
      if (profile.role === "super_admin") {
        return apiError(
          "No clinic context selected. Use the clinic selector to choose a clinic before chatting.",
          400,
          "NO_CLINIC_CONTEXT",
        );
      }
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    const allowed = await aiManagerLimiter.check(`ai-team:${userId}`);
    if (!allowed) {
      return apiRateLimited("Daily limit reached. Try again tomorrow.");
    }

    const clinicAllowed = await aiClinicCeilingLimiter.check(`ai:clinic:${clinicId}`);
    if (!clinicAllowed) {
      return apiRateLimited("Clinic daily AI limit reached. Try again tomorrow.");
    }

    const aiResult = await resolveAIConfig();
    if (!aiResult.ok) {
      return apiError(aiResult.reason, aiResult.statusCode, "AI_NOT_CONFIGURED");
    }
    const { apiKey, baseUrl, model } = aiResult.config;

    const { agentType, message, conversationHistory } = data;

    const systemPrompt = getSystemPrompt(agentType);
    const dataContext = await fetchAgentData(supabase, clinicId, agentType);

    const sanitizedHistory = conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: sanitizeUntrustedText(m.content),
    }));

    const userMessage = `${sanitizeUntrustedText(message)}\n\n${dataContext}`;

    try {
      const aiResponse = await fetchWithAICircuitBreaker(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              ...sanitizedHistory,
              { role: "user", content: userMessage },
            ],
            max_tokens: 2000,
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(30_000),
        },
        { provider: aiResult.config.provider },
      );

      if (!aiResponse.ok) {
        const errorBody = await aiResponse.text().catch(() => "unknown");
        logger.error("AI API request failed", {
          context: "ai-team-chat",
          status: aiResponse.status,
          clinicId,
          agentType,
          errorBody: errorBody.slice(0, 500),
        });
        return apiInternalError("AI service temporarily unavailable. Please try again.");
      }

      const aiData = (await aiResponse.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const rawContent = aiData.choices?.[0]?.message?.content;

      if (!rawContent) {
        logger.warn("AI returned empty response", {
          context: "ai-team-chat",
          clinicId,
          agentType,
        });
        return apiInternalError("AI service returned no valid response.");
      }

      const content = validateAIOutput(rawContent);
      if (!content) {
        logger.warn("AI output rejected by safety validator", {
          context: "ai-team-chat/output-safety",
          clinicId,
          agentType,
        });
        return apiInternalError("AI response rejected by safety validator.");
      }

      const agentResponse = parseAgentResponse(content);
      if (!agentResponse) {
        return apiInternalError("AI response could not be interpreted. Please try again.");
      }

      const safeMessage = message
        .slice(0, 200)
        .replace(/(?:\+212|0)([ .\-]?\d){9}/g, "[REDACTED_PHONE]")
        .replace(/\b[A-Z]{1,2}\d{5,7}\b/g, "[REDACTED_CIN]");

      void logAuditEvent({
        supabase,
        action: "ai_team_chat",
        type: "admin",
        clinicId,
        actor: userId,
        description: `AI Team ${agentType} agent chat`,
        metadata: { agentType, question: safeMessage },
      });

      return apiSuccess({
        agentType,
        response: agentResponse,
        disclaimer: getAIDisclaimer(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return apiError("AI service timed out. Please try again.", 504, "AI_TIMEOUT");
      }
      logger.error("AI Team chat failed", {
        context: "ai-team-chat",
        clinicId,
        agentType,
        error: err,
      });
      return apiInternalError("AI request failed. Please try again.");
    }
  },
  ["clinic_admin", "super_admin"],
);
