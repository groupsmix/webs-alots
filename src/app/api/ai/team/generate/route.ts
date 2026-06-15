/**
 * POST /api/ai/team/generate
 *
 * Triggers an AI agent to analyze current data and generate tasks/alerts.
 * This is called when the user clicks "Refresh" or "Generate insights"
 * on a specific agent card.
 */

import { type NextRequest } from "next/server";
import { fetchWithAICircuitBreaker } from "@/lib/ai/circuit-breaker";
import { resolveAIConfig } from "@/lib/ai/config";
import {
  fetchMarketingData,
  fetchSupportData,
  fetchReminderData,
  buildMarketingDataContext,
  buildSupportDataContext,
  buildReminderDataContext,
  createTeamTask,
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
import { aiTeamGenerateSchema } from "@/lib/validations/ai-team";
import type { AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

interface GeneratedTask {
  title: string;
  description: string;
  priority: string;
  dueDate?: string;
}

interface GeneratedAlert {
  title: string;
  message: string;
  severity: string;
}

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

async function fetchAndBuildContext(
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

function parseGenerateResponse(content: string): {
  tasks: GeneratedTask[];
  alerts: GeneratedAlert[];
  suggestions: string[];
} | null {
  try {
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    return {
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
    logger.warn("Failed to parse generate response", {
      context: "ai-team-generate",
      contentPreview: content.slice(0, 200),
    });
    return null;
  }
}

const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const VALID_SEVERITIES = new Set(["info", "warning", "critical"]);

export const POST = withAuthValidation(
  aiTeamGenerateSchema,
  async (data, _request: NextRequest, auth) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const userId = profile.id;

    if (!clinicId) {
      return apiError("Aucune clinique associée à ce compte", 403, "NO_CLINIC");
    }

    const allowed = await aiManagerLimiter.check(`ai-team-gen:${userId}`);
    if (!allowed) {
      return apiRateLimited("Limite quotidienne atteinte. Réessayez demain.");
    }

    const clinicAllowed = await aiClinicCeilingLimiter.check(`ai:clinic:${clinicId}`);
    if (!clinicAllowed) {
      return apiRateLimited(
        "Limite quotidienne de la clinique atteinte pour les fonctionnalités IA.",
      );
    }

    const aiResult = await resolveAIConfig();
    if (!aiResult.ok) {
      return apiError(aiResult.reason, aiResult.statusCode, "AI_NOT_CONFIGURED");
    }
    const { apiKey, baseUrl, model } = aiResult.config;

    const { agentType } = data;
    const systemPrompt = getSystemPrompt(agentType);
    const dataContext = await fetchAndBuildContext(supabase, clinicId, agentType);

    const userMessage = `Analyse les données actuelles de la clinique et génère des tâches, alertes et suggestions pertinentes.\n\n${dataContext}`;

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
          context: "ai-team-generate",
          status: aiResponse.status,
          clinicId,
          agentType,
          errorBody: errorBody.slice(0, 500),
        });
        return apiInternalError("Le service IA est temporairement indisponible.");
      }

      const aiData = (await aiResponse.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const rawContent = aiData.choices?.[0]?.message?.content;

      if (!rawContent) {
        return apiInternalError("Le service IA n'a pas retourné de réponse valide.");
      }

      const content = validateAIOutput(rawContent);
      if (!content) {
        return apiInternalError("La réponse IA a été rejetée par le validateur de sécurité.");
      }

      const generated = parseGenerateResponse(content);
      if (!generated) {
        return apiInternalError("La réponse IA n'a pas pu être interprétée.");
      }

      const untypedSupa = supabase as unknown as SupabaseUntyped;

      // Save tasks to DB (legacy ai_agent_tasks + new ai_team_tasks)
      const savedTasks: { id: string; title: string }[] = [];
      for (const task of generated.tasks.slice(0, 10)) {
        const priority = VALID_PRIORITIES.has(task.priority) ? task.priority : "medium";
        try {
          const { data: saved } = await untypedSupa
            .from("ai_agent_tasks")
            .insert({
              clinic_id: clinicId,
              agent_type: agentType,
              title: task.title.slice(0, 255),
              description: task.description.slice(0, 2000),
              priority,
              status: "pending",
              due_date: task.dueDate ?? null,
            })
            .select("id, title")
            .single();
          if (saved) {
            savedTasks.push(saved as { id: string; title: string });
          }
        } catch (err) {
          logger.warn("Failed to save AI task", {
            context: "ai-team-generate",
            error: err,
            clinicId,
          });
        }

        // Also create durable team task (C1 state machine)
        try {
          await createTeamTask(untypedSupa, clinicId, {
            title: task.title.slice(0, 255),
            description: task.description.slice(0, 2000),
            agentType,
            createdBy: userId,
          });
        } catch (teamTaskErr) {
          logger.warn("Failed to create durable team task", {
            context: "ai-team-generate",
            error: teamTaskErr,
            clinicId,
          });
        }
      }

      // Save alerts to DB
      const savedAlerts: { id: string; title: string }[] = [];
      for (const alert of generated.alerts.slice(0, 10)) {
        const severity = VALID_SEVERITIES.has(alert.severity) ? alert.severity : "info";
        try {
          const { data: saved } = await untypedSupa
            .from("ai_agent_alerts")
            .insert({
              clinic_id: clinicId,
              agent_type: agentType,
              title: alert.title.slice(0, 255),
              message: alert.message.slice(0, 2000),
              severity,
            })
            .select("id, title")
            .single();
          if (saved) {
            savedAlerts.push(saved as { id: string; title: string });
          }
        } catch (err) {
          logger.warn("Failed to save AI alert", {
            context: "ai-team-generate",
            error: err,
            clinicId,
          });
        }
      }

      void logAuditEvent({
        supabase,
        action: "ai_team_generate",
        type: "admin",
        clinicId,
        actor: userId,
        description: `Équipe IA ${agentType} : ${savedTasks.length} tâche(s) et ${savedAlerts.length} alerte(s) générée(s)`,
        metadata: {
          agentType,
          tasksCount: String(savedTasks.length),
          alertsCount: String(savedAlerts.length),
        },
      });

      return apiSuccess({
        agentType,
        tasksCreated: savedTasks.length,
        alertsCreated: savedAlerts.length,
        suggestions: generated.suggestions,
        disclaimer: getAIDisclaimer(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return apiError("Le service IA a mis trop de temps à répondre.", 504, "AI_TIMEOUT");
      }
      logger.error("AI Team generate failed", {
        context: "ai-team-generate",
        clinicId,
        agentType,
        error: err,
      });
      return apiInternalError("Erreur lors de la génération IA.");
    }
  },
  ["clinic_admin", "super_admin"],
);
