/**
 * PATCH /api/ai/team/alerts
 *
 * Mark an AI agent alert as read.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { aiTeamAlertReadSchema } from "@/lib/validations/ai-team";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export const PATCH = withAuthValidation(
  aiTeamAlertReadSchema,
  async (data, _request: NextRequest, auth) => {
    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;

    if (!clinicId) {
      return apiError("No clinic associated with this account", 403, "NO_CLINIC");
    }

    const { alertId } = data;
    const untypedSupa = supabase as unknown as SupabaseUntyped;

    try {
      const { data: updated, error } = await untypedSupa
        .from("ai_agent_alerts")
        .update({ is_read: true })
        .eq("id", alertId)
        .eq("clinic_id", clinicId)
        .select("id, is_read")
        .single();

      if (error || !updated) {
        return apiError("Alert not found", 404, "NOT_FOUND");
      }

      return apiSuccess({ alert: updated as { id: string; is_read: boolean } });
    } catch (err) {
      logger.error("Failed to mark alert as read", {
        context: "api/ai/team/alerts",
        error: err,
        clinicId,
      });
      return apiInternalError("Erreur lors de la mise à jour de l'alerte.");
    }
  },
  ["clinic_admin", "super_admin"],
);
