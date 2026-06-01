import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { sendAppointmentConfirmations } from "@/lib/automation/appointment-confirmation";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/confirm-appointments
 *
 * Cron job that runs periodically to send appointment confirmation requests via WhatsApp.
 * It iterates through all active clinics, checks for appointments 24-48h ahead,
 * and enqueues WhatsApp messages asking the patient to confirm or cancel.
 *
 * Auth: Internal CRON_SECRET only
 */
export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const supabase = createUntypedAdminClient("cron");

  try {
    // 1. Fetch all active clinics
    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select("id")
      .eq("status", "active");

    if (clinicsError) {
      throw clinicsError;
    }

    let totalProcessed = 0;
    let totalErrors = 0;

    // 2. Iterate and process confirmations per clinic
    // (Oltigo architecture rule: operations must be scoped per clinic)
    for (const clinic of clinics || []) {
      const { processed, errors } = await sendAppointmentConfirmations(supabase, clinic.id);
      totalProcessed += processed;
      totalErrors += errors;
    }

    logger.info("Appointment confirmation cron finished", {
      context: "cron/confirm-appointments",
      clinicsProcessed: clinics?.length || 0,
      totalProcessed,
      totalErrors,
    });

    return apiSuccess({
      message: "Confirmations processed",
      stats: {
        clinics: clinics?.length || 0,
        processed: totalProcessed,
        errors: totalErrors,
      },
    });
  } catch (err) {
    logger.error("Appointment confirmation cron failed", {
      context: "cron/confirm-appointments",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Cron execution failed");
  }
}
