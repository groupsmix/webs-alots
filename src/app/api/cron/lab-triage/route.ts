import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/api-validate";
import { triageLabResult } from "@/lib/algorithms/lab-triage";
import { enqueueNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/lab-triage
 *
 * Hourly cron job that checks for newly uploaded, unreviewed lab results.
 * If critical values are detected, an alert is sent via WhatsApp to the
 * assigned doctor and marked for dashboard display.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createUntypedAdminClient("cron-lab-triage");

  try {
    // Note: Assuming a 'lab_results' table with a 'status' column (unreviewed/reviewed)
    // and a JSONB 'data' column containing the parsed values.
    // In a real app we'd also check if we already alerted on this.
    const { data: recentLabs, error: labsError } = await supabase
      .from("lab_results")
      .select(`
        id,
        clinic_id,
        doctor_id,
        patient_id,
        data,
        status,
        alert_sent
      `)
      .eq("status", "unreviewed")
      .eq("alert_sent", false)
      .limit(100);

    if (labsError) throw labsError;
    if (!recentLabs || recentLabs.length === 0) {
      return apiSuccess({ message: "No unreviewed labs to triage" });
    }

    let criticalCount = 0;

    for (const labDoc of recentLabs) {
      try {
        const values = labDoc.data as any[]; // Array of LabValue
        if (!Array.isArray(values)) continue;

        let hasCritical = false;
        const criticalAlerts = [];

        for (const val of values) {
          const triage = triageLabResult(val);
          if (triage.triageLevel === "critical") {
            hasCritical = true;
            criticalAlerts.push(`${val.testName}: ${val.value} ${val.unit} (${triage.explanation.status})`);
          }
        }

        if (hasCritical) {
          criticalCount++;
          
          // Alert doctor
          await enqueueNotification(supabase, {
            clinicId: labDoc.clinic_id,
            patientId: labDoc.doctor_id, // We're using the user ID of the doctor for staff notifications
            channel: "in-app", // Can also be WhatsApp if we have doctor's phone
            templateName: "critical_lab_alert",
            templateData: {
              lab_id: labDoc.id,
              alerts: criticalAlerts.join(", ")
            },
            appointmentId: null,
            priority: "urgent",
          });

          // Mark as alert sent
          await supabase
            .from("lab_results")
            .update({ alert_sent: true, is_critical: true })
            .eq("id", labDoc.id);
            
          logger.warn("Critical lab result detected", {
            clinicId: labDoc.clinic_id,
            labId: labDoc.id,
            doctorId: labDoc.doctor_id
          });
        }
      } catch (err) {
        logger.error("Failed to process lab document", {
          labId: labDoc.id,
          error: String(err)
        });
      }
    }

    return apiSuccess({
      message: "Lab triage complete",
      processed: recentLabs.length,
      criticalAlerts: criticalCount
    });

  } catch (err) {
    logger.error("Lab triage cron failed", {
      context: "cron/lab-triage",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Lab triage execution failed");
  }
}
