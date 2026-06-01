/**
 * POST /api/v1/ai/drug-check
 *
 * Pure-function CDSS drug interaction checker with bidirectional checking.
 * Adapted from ECC healthcare-cdss-patterns.
 *
 * Unlike the AI-enhanced endpoint, this uses only the local CDSS engine
 * with zero external API calls — suitable for real-time inline checks.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiRateLimited } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { checkInteractions, validateDose, suggestAlternatives, ALERT_DISPLAY_MAP } from "@/lib/cdss";
import type { DoseRoute, AlternativeSuggestion } from "@/lib/cdss";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { aiDrugCheckLimiter } from "@/lib/rate-limit";
import { cdssCheckRequestSchema } from "@/lib/validations/clinical-cdss";
import type { AuthContext } from "@/lib/with-auth";

export const POST = withAuthValidation(
  cdssCheckRequestSchema,
  async (data, _request: NextRequest, auth: AuthContext) => {
    // F-AI-01: Early kill switch — fail fast before processing
    if (!(await isAIEnabled())) {
      return apiError("AI features are disabled", 503, "AI_DISABLED");
    }

    const { profile, supabase } = auth;
    const clinicId = profile.clinic_id;
    const doctorId = profile.id;

    if (!clinicId) {
      return apiError("Aucune clinique associée à ce compte", 403, "NO_CLINIC");
    }

    const allowed = await aiDrugCheckLimiter.check(`cdss-check:${doctorId}`);
    if (!allowed) {
      return apiRateLimited("Limite quotidienne atteinte. Réessayez demain.");
    }

    const interactionAlerts = checkInteractions(
      data.newDrug,
      data.currentMedications ?? [],
      data.allergies ?? [],
    );

    let doseResult = null;
    if (data.dose !== undefined && data.route) {
      doseResult = validateDose(
        data.newDrug,
        data.dose,
        data.route as DoseRoute,
        data.patientWeight,
        data.patientAge,
        data.renalFunction,
      );
    }

    const alternatives: AlternativeSuggestion[] = [];
    for (const alert of interactionAlerts) {
      if (alert.severity === "critical" || alert.severity === "major") {
        // alert.pair is [newDrug, currentMedication] or [newDrug, allergy]
        const alt = suggestAlternatives(alert.pair[0], alert.pair[1]);
        if (alt && !alternatives.find((a) => a.interactsWith === alt.interactsWith)) {
          alternatives.push(alt);
        }
      }
    }

    const hasCritical = interactionAlerts.some((a) => a.severity === "critical");
    const hasMajor = interactionAlerts.some((a) => a.severity === "major");
    const blocked = hasCritical || (doseResult !== null && !doseResult.valid);

    if (interactionAlerts.length > 0 || (doseResult && !doseResult.valid)) {
      void logAuditEvent({
        supabase,
        action: "cdss_drug_check",
        type: "admin",
        clinicId,
        actor: doctorId,
        description: `Vérification CDSS : ${data.newDrug}`,
        metadata: {
          newDrug: data.newDrug,
          alertCount: interactionAlerts.length,
          hasCritical,
          blocked,
        },
      }).catch((err) => {
        logger.warn("Audit log failed for CDSS check", {
          context: "cdss-drug-check",
          error: err,
        });
      });
    }

    return apiSuccess({
      blocked,
      interactionAlerts: interactionAlerts.map((a) => ({
        ...a,
        display: ALERT_DISPLAY_MAP[a.severity],
      })),
      alternatives,
      doseValidation: doseResult,
      overallSeverity: hasCritical ? "critical" : hasMajor ? "major" : "safe",
    });
  },
  ["doctor", "clinic_admin", "super_admin"],
);
