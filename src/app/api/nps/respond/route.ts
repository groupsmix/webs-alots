import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { npsSurveyResponseSchema } from "@/lib/validations/patient-experience";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/nps/respond
 *
 * Patient submits their NPS score (0-10) and optional comment.
 * No auth required — patients click a link from WhatsApp.
 */
export const POST = withValidation(npsSurveyResponseSchema, async (data) => {
  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    return apiError("Clinic context required — use a clinic subdomain", 400);
  }
  const clinicId = tenant.clinicId;

  try {
    const supabase = await createTenantClient(clinicId);
    const untypedSupabase = supabase as unknown as SupabaseUntyped;

    const { data: survey, error: fetchError } = await untypedSupabase
      .from("nps_surveys")
      .select("id, score, clinic_id")
      .eq("id", data.surveyId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !survey) {
      return apiError("Survey not found", 404, "NOT_FOUND");
    }

    type SurveyRow = { id: string; score: number | null; clinic_id: string };
    const surveyRow = survey as SurveyRow;

    if (surveyRow.score !== null) {
      return apiError("Survey already completed", 409, "ALREADY_RESPONDED");
    }

    const { error: updateError } = await untypedSupabase
      .from("nps_surveys")
      .update({
        score: data.score,
        comment: data.comment ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.surveyId)
      .eq("clinic_id", clinicId);

    if (updateError) {
      logger.error("Failed to save NPS response", {
        context: "api/nps/respond",
        error: updateError,
      });
      return apiInternalError("Failed to save response");
    }

    await logAuditEvent({
      supabase,
      action: "nps_survey_responded",
      type: "patient",
      clinicId,
      description: `NPS survey ${data.surveyId} responded with score ${data.score}`,
      metadata: { surveyId: data.surveyId, score: String(data.score) },
    });

    return apiSuccess({ recorded: true });
  } catch (err) {
    logger.error("Failed to process NPS response", {
      context: "api/nps/respond",
      error: err,
    });
    return apiInternalError("Failed to process NPS response");
  }
});
