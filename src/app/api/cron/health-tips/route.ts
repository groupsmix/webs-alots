import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/api-validate";
import { generateHealthTip } from "@/lib/algorithms/health-tip-generator";
import { enqueueNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/health-tips
 *
 * Daily cron job that finds consultations from 24-48h ago and sends
 * personalized follow-up health tips to patients via WhatsApp.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createUntypedAdminClient("cron-health-tips");

  try {
    const now = new Date();
    // 48h to 24h ago
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent consultations
    // Note: Assuming a 'consultations' table with a 'diagnosis_codes' array column.
    // If diagnosis are on the appointment, we would query that instead.
    const { data: consultations, error } = await supabase
      .from("consultations")
      .select(`
        id,
        clinic_id,
        patient_id,
        created_at,
        diagnosis_codes,
        patient:patient_id (
          id,
          phone,
          first_name
        )
      `)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString())
      .limit(200);

    if (error) throw error;
    if (!consultations || consultations.length === 0) {
      return apiSuccess({ message: "No consultations found in the time window" });
    }

    let sentCount = 0;

    for (const consult of consultations) {
      try {
        const patientData = consult.patient as unknown as { id: string; phone: string | null; first_name: string };
        if (!patientData.phone) continue;

        // Generate tip
        const codes = consult.diagnosis_codes as string[] || [];
        const tip = generateHealthTip(codes);

        // We use Darija for WhatsApp tips as requested in requirements
        const messageText = tip.tipAr;

        // Enqueue WhatsApp message
        await enqueueNotification(supabase, {
          clinicId: consult.clinic_id,
          patientId: patientData.id,
          channel: "whatsapp",
          templateName: "health_tip_darija", 
          templateData: {
            patient_name: patientData.first_name,
            tip_content: messageText
          },
          appointmentId: null,
          priority: "low",
        });

        sentCount++;
      } catch (err) {
        logger.error("Failed to generate/send health tip", {
          consultationId: consult.id,
          error: String(err)
        });
      }
    }

    logger.info("Health tips cron completed", {
      context: "cron/health-tips",
      processed: consultations.length,
      sentCount
    });

    return apiSuccess({
      message: "Health tips processed",
      processed: consultations.length,
      sent: sentCount
    });

  } catch (err) {
    logger.error("Health tips cron failed", {
      context: "cron/health-tips",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Health tips execution failed");
  }
}
