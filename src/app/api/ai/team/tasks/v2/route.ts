/**
 * /api/ai/team/tasks/v2
 *
 * POST  — Create a new AI team task (C1)
 * PATCH — Transition a task to a new status (C1 state machine)
 *
 * Uses the durable ai_team_tasks table with history events and review cycle.
 */

import { type NextRequest } from "next/server";
import { transitionTask, createTeamTask, type TaskStatus } from "@/lib/ai/team-data";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { aiTeamTaskCreateSchema, aiTeamTaskTransitionSchema } from "@/lib/validations/ai-team";
import type { AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/** POST: Create a new AI team task */
export const POST = withAuthValidation(
  aiTeamTaskCreateSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const userId = profile.id;

    if (!clinicId) {
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    try {
      const untypedSupa = supabase as unknown as SupabaseUntyped;
      const result = await createTeamTask(untypedSupa, clinicId, {
        title: data.title,
        description: data.description,
        agentType: data.agentType,
        reviewerAgentType: data.reviewerAgentType,
        createdBy: userId,
      });

      if (!result) {
        return apiInternalError("Failed to create task.");
      }

      void logAuditEvent({
        supabase,
        action: "ai_team_task_created",
        type: "admin",
        clinicId,
        actor: userId,
        description: `AI team task created: ${data.title}`,
        metadata: {
          taskId: result.id,
          agentType: data.agentType,
          reviewerAgentType: data.reviewerAgentType,
        },
      });

      return apiSuccess({ task: { id: result.id, status: "backlog" } }, 201);
    } catch (err) {
      logger.error("Failed to create AI team task", {
        context: "api/ai/team/tasks/v2",
        error: err,
        clinicId,
      });
      return apiInternalError("Failed to create task.");
    }
  },
  ["clinic_admin", "super_admin"],
);

/** PATCH: Transition a task status */
export const PATCH = withAuthValidation(
  aiTeamTaskTransitionSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const userId = profile.id;

    if (!clinicId) {
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    try {
      const untypedSupa = supabase as unknown as SupabaseUntyped;
      const result = await transitionTask(
        untypedSupa,
        data.taskId,
        clinicId,
        data.fromStatus as TaskStatus,
        data.toStatus as TaskStatus,
        userId,
        { reviewComments: data.reviewComments },
      );

      if (!result.ok) {
        const statusCode = result.code === "TASK_NOT_FOUND" ? 404 : 409;
        return apiError(result.message, statusCode, result.code);
      }

      void logAuditEvent({
        supabase,
        action: "ai_team_task_transitioned",
        type: "admin",
        clinicId,
        actor: userId,
        description: `AI task ${data.taskId}: ${data.fromStatus} → ${result.newStatus}`,
        metadata: {
          taskId: data.taskId,
          from: data.fromStatus,
          to: result.newStatus,
          escalated: result.escalated,
          reviewComments: data.reviewComments,
        },
      });

      // If escalated, create an alert via the existing alerts path
      if (result.escalated) {
        try {
          await untypedSupa.from("ai_agent_alerts").insert({
            clinic_id: clinicId,
            agent_type: "support",
            title: "Cycle de révision maximum atteint",
            message: `La tâche ${data.taskId} a dépassé le nombre maximum de cycles de révision. Intervention humaine requise.`,
            severity: "warning",
          });
        } catch (alertErr) {
          logger.warn("Failed to create escalation alert", {
            context: "api/ai/team/tasks/v2",
            error: alertErr,
            taskId: data.taskId,
          });
        }
      }

      return apiSuccess({
        task: {
          id: data.taskId,
          status: result.newStatus,
          escalated: result.escalated,
        },
      });
    } catch (err) {
      logger.error("Failed to transition AI team task", {
        context: "api/ai/team/tasks/v2",
        error: err,
        clinicId,
      });
      return apiInternalError("Failed to transition task.");
    }
  },
  ["clinic_admin", "super_admin"],
);
