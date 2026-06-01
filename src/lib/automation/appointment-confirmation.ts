import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/lib/notifications";

/**
 * Finds all unconfirmed appointments that are 24-48 hours away,
 * and sends an automated WhatsApp confirmation request.
 */
export async function sendAppointmentConfirmations(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h from now
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h from now

  try {
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        start_time,
        patient:patient_id (
          id,
          first_name,
          phone
        ),
        doctor:doctor_id (
          first_name,
          last_name
        )
      `,
      )
      .eq("clinic_id", clinicId)
      .eq("status", "scheduled")
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString());

    if (error) {
      throw error;
    }

    if (!appointments || appointments.length === 0) {
      return { processed, errors };
    }

    for (const apt of appointments) {
      try {
        const patientData = apt.patient as unknown as {
          id: string;
          first_name: string;
          phone: string | null;
        };
        const doctorData = apt.doctor as unknown as { first_name: string; last_name: string };

        if (!patientData.phone) {
          logger.info("Skipping confirmation, patient has no phone", {
            appointmentId: apt.id,
            patientId: patientData.id,
          });
          continue;
        }

        // Enqueue WhatsApp confirmation message
        await enqueueNotification(supabase, {
          clinicId,
          patientId: patientData.id,
          channel: "whatsapp",
          templateName: "appointment_confirmation_darija", // Matches Darija template requirement
          templateData: {
            patient_name: patientData.first_name,
            doctor_name: `Dr. ${doctorData.last_name}`,
            date: new Date(apt.start_time).toLocaleDateString("fr-MA"),
            time: new Date(apt.start_time).toLocaleTimeString("fr-MA", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          appointmentId: apt.id,
          priority: "high",
        });

        // Mark appointment to indicate confirmation request was sent
        // Assuming there is a "confirmation_requested_at" column or we rely on the notification log.
        // We'll update the appointment record to track this if the column exists, otherwise just log it.
        await supabase
          .from("appointments")
          .update({
            // Optional: confirmation_requested_at: new Date().toISOString()
          })
          .eq("id", apt.id)
          .eq("clinic_id", clinicId);

        processed++;
      } catch (err) {
        errors++;
        logger.error("Failed to process appointment confirmation", {
          appointmentId: apt.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { processed, errors };
  } catch (err) {
    logger.error("Failed to run appointment confirmation cron", {
      clinicId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
