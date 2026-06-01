import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/api-validate";
import { checkExpiringLicenses } from "@/lib/automation/license-monitor";
import { enqueueNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/license-check
 *
 * Daily cron job that checks for doctor medical licenses (INOM) expiring
 * within 90, 60, or 30 days and sends an alert.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createUntypedAdminClient("cron-license-check");

  try {
    const expiringLicenses = await checkExpiringLicenses(supabase);

    let alertCount = 0;

    for (const license of expiringLicenses) {
      // We trigger alerts exactly at 90, 60, 30, 14, 7, and 0 days
      // to avoid spamming the doctor every single day.
      const d = license.daysUntilExpiry;
      if ([90, 60, 30, 14, 7, 0, -1].includes(d)) {
        
        // Notify the doctor
        await enqueueNotification(supabase, {
          clinicId: "system", // Or resolve doctor's primary clinic
          patientId: license.doctorId, // using patientId field for the recipient user ID
          channel: "email",
          templateName: "license_expiry_warning",
          templateData: {
            doctor_name: license.doctorName,
            license_number: license.licenseNumber,
            days_remaining: d,
            expiry_date: new Date(license.expiryDate).toLocaleDateString("fr-MA")
          },
          appointmentId: null,
          priority: d <= 30 ? "urgent" : "normal"
        });

        alertCount++;
        
        logger.info(`Sent license expiry alert to ${license.doctorId}`, {
          daysRemaining: d
        });
      }
    }

    return apiSuccess({
      message: "License check completed",
      totalExpiring: expiringLicenses.length,
      alertsSent: alertCount
    });

  } catch (err) {
    logger.error("License check cron failed", {
      context: "cron/license-check",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("License check execution failed");
  }
}
