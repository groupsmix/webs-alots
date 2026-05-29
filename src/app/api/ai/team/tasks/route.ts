/**
 * PATCH /api/ai/team/tasks
 *
 * Update the status of an AI agent task.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { aiTeamTaskUpdateSchema } from "@/lib/validations/ai-team";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export const PATCH = withAuthValidation(
  aiTeamTaskUpdateSchema,
  async (data, _request: NextRequest, auth) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const userId = profile.id;

    if (!clinicId) {
      return apiError("Aucune clinique associée à ce compte", 403, "NO_CLINIC");
    }

    const { taskId, status } = data;
    const untypedSupa = supabase as unknown as SupabaseUntyped;

    try {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: updated, error } = await untypedSupa
        .from("ai_agent_tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("clinic_id", clinicId)
        .select("id, status, agent_type")
        .single();

      if (error || !updated) {
        logger.error("Failed to update AI task", {
          context: "api/ai/team/tasks",
          error,
          clinicId,
          taskId,
        });
        return apiError("Tâche introuvable", 404, "NOT_FOUND");
      }

      const task = updated as { id: string; status: string; agent_type: string };

      void logAuditEvent({
        supabase,
        action: "ai_team_task_updated",
        type: "admin",
        clinicId,
        actor: userId,
        description: `AI task ${taskId} status changed to ${status}`,
        metadata: { taskId, status, agentType: task.agent_type },
      });

      return apiSuccess({ task });
    } catch (err) {
      logger.error("Failed to update AI task", {
        context: "api/ai/team/tasks",
        error: err,
        clinicId,
      });
      return apiInternalError("Erreur lors de la mise à jour de la tâche.");
    }
  },
  ["clinic_admin", "super_admin"],
);
