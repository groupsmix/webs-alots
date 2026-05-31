/**
 * POST /api/admin/chatbot-bulk
 *
 * Feature Task 4: Bulk chatbot activation by subscription plan.
 * Superadmin-only endpoint that provisions chatbot for all clinics
 * matching a given plan tier.
 *
 * Body: { plan: PlanSlug, action: "enable" | "disable" }
 * Returns: { affected: number, results: Array<{ clinicId, status }> }
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { provisionChatbotForPlan, getChatbotLevelForPlan } from "@/lib/chatbot-provisioning";
import { logger } from "@/lib/logger";
import type { AuthContext } from "@/lib/with-auth";

const bulkChatbotSchema = z.object({
  plan: z.enum(["free", "starter", "professional", "enterprise"]),
  action: z.enum(["enable", "disable"]),
});

export const POST = withAuthValidation(
  bulkChatbotSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    const { supabase, profile } = auth;
    const targetPlan = data.plan;
    const action = data.action;
    const level = getChatbotLevelForPlan(targetPlan);

    if (action === "enable" && level === false) {
      return apiError(`Le plan "${targetPlan}" n'inclut pas le chatbot.`, 400, "PLAN_NO_CHATBOT");
    }

    // Find clinics on the target plan
    const { data: clinics, error: queryErr } = await supabase
      .from("clinics")
      .select("id, name, config");

    if (queryErr) {
      logger.error("Failed to query clinics for bulk chatbot", {
        context: "admin/chatbot-bulk",
        error: queryErr,
      });
      return apiError("Erreur lors de la recherche des cliniques", 500);
    }

    // Filter clinics by subscription_plan in config
    const matchingClinics = (clinics ?? []).filter((c) => {
      const config = c.config as Record<string, unknown> | null;
      return config?.subscription_plan === targetPlan;
    });

    if (matchingClinics.length === 0) {
      return apiSuccess({
        affected: 0,
        results: [],
        message: `Aucune clinique trouvée avec le plan "${targetPlan}".`,
      });
    }

    const results: Array<{
      clinicId: string;
      clinicName: string;
      status: "ok" | "error";
    }> = [];

    const effectivePlan = action === "disable" ? "free" : targetPlan;

    for (const clinic of matchingClinics) {
      try {
        await provisionChatbotForPlan(supabase, clinic.id, effectivePlan);
        results.push({
          clinicId: clinic.id,
          clinicName: clinic.name,
          status: "ok",
        });
      } catch (err) {
        logger.error("Bulk chatbot provisioning failed for clinic", {
          context: "admin/chatbot-bulk",
          clinicId: clinic.id,
          error: err,
        });
        results.push({
          clinicId: clinic.id,
          clinicName: clinic.name,
          status: "error",
        });
      }
    }

    const succeeded = results.filter((r) => r.status === "ok").length;

    void logAuditEvent({
      supabase,
      clinicId: "system",
      action: "bulk_chatbot_provisioning",
      type: "config",
      actor: profile.id,
      description: `Bulk ${action} chatbot for ${targetPlan} plan: ${succeeded}/${matchingClinics.length} clinics`,
      metadata: {
        plan: targetPlan,
        action,
        totalClinics: matchingClinics.length,
        succeeded,
        failed: matchingClinics.length - succeeded,
      },
    });

    return apiSuccess({
      affected: succeeded,
      total: matchingClinics.length,
      results,
    });
  },
  ["super_admin"],
);
