import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createClient } from "@/lib/supabase-server";
import { sendInteractiveMessage, sendTextMessage } from "@/lib/whatsapp";

/**
 * GET /api/cron/rebooking-reminders
 *
 * Cron job that runs every hour to:
 * 1. Send 24h reminders for pending rebooking requests
 * 2. Expire rebooking requests older than 48h
 * 3. Cancel original appointments and notify unresponsive patients
 *
 * Protected by CRON_SECRET via Authorization: Bearer header.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();

    // Audit 7.1: Short-circuit if there are no active clinics to save DB compute
    const { count } = await supabase.from("clinics").select("*", { count: "exact", head: true }).eq("status", "active");
    if (!count || count === 0) {
      return apiSuccess({ message: "No active clinics, skipping cron", sent: 0 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // rebooking_requests not yet in generated types — cast through unknown
    type RbPerson = { id: string; name: string; phone: string | null };
    type RbReminderRow = {
      id: string;
      appointment_id: string;
      patient_id: string;
      doctor_id: string;
      clinic_id: string;
      alternatives: unknown;
      reminded_at: string | null;
      sent_at: string;
      patients: RbPerson | RbPerson[] | null;
      doctors: { id: string; name: string } | Array<{ id: string; name: string }> | null;
    };
    type RbCronClient = {
      from(t: string): {
        select(s: string): {
          eq(c: string, v: string): RbCronChain;
        };
        update(row: Record<string, unknown>): {
          eq(c: string, v: string): Promise<void>;
        };
      };
    };
    type RbCronChain = {
      eq(c: string, v: string): RbCronChain;
      is(c: string, v: null): RbCronChain;
      lte(c: string, v: string): RbCronChain;
      gt(c: string, v: string): RbCronChain;
      limit(n: number): Promise<{ data: RbReminderRow[] | null }>;
    };
    const rbCron = supabase as unknown as RbCronClient;

    // 1. Find pending requests that were sent 24h ago but not yet reminded
    const { data: needsReminder } = await rbCron
      .from("rebooking_requests")
      .select(`
        id,
        appointment_id,
        patient_id,
        doctor_id,
        clinic_id,
        alternatives,
        reminded_at,
        sent_at,
        patients:patient_id (id, name, phone),
        doctors:doctor_id (id, name)
      `)
      .eq("status", "pending")
      .is("reminded_at", null)
      .lte("sent_at", twentyFourHoursAgo.toISOString())
      .gt("sent_at", fortyEightHoursAgo.toISOString())
      .limit(100);

    let remindersSent = 0;

    for (const req of needsReminder ?? []) {
      const patientRaw = req.patients;
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
      const doctorRaw = req.doctors;
      const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;

      if (!patient?.phone) continue;

      const alternatives = req.alternatives as Array<{
        option_index: number;
        label: string;
      }> | null;

      if (!alternatives || alternatives.length === 0) continue;

      const buttons = alternatives.slice(0, 3).map((alt) => ({
        id: `REBOOK_${req.appointment_id}_${alt.option_index}`,
        title: alt.label.slice(0, 20),
      }));

      try {
        const result = await sendInteractiveMessage({
          to: patient.phone,
          body:
            `Reminder: ${patient.name}, you still need to rebook your appointment ` +
            `with ${doctor?.name ?? "your doctor"}. Please choose a new time slot:`,
          buttons,
          header: "Rebooking Reminder",
          footer: "Last chance to rebook",
        });

        if (result.success) {
          await rbCron
            .from("rebooking_requests")
            .update({ reminded_at: now.toISOString() })
            .eq("id", req.id);
          remindersSent++;
        }
      } catch (err) {
        logger.warn("Failed to send rebooking reminder", {
          context: "cron/rebooking-reminders",
          requestId: req.id,
          error: err,
        });
      }
    }

    // 2. Expire requests older than 48 hours
    const { data: expiredRequests } = await rbCron
      .from("rebooking_requests")
      .select(`
        id,
        appointment_id,
        patient_id,
        clinic_id,
        patients:patient_id (id, name, phone),
        doctors:doctor_id (id, name)
      `)
      .eq("status", "pending")
      .lte("sent_at", fortyEightHoursAgo.toISOString())
      .limit(100);

    let expiredCount = 0;
    let cancelledCount = 0;

    for (const req of expiredRequests ?? []) {
      // Mark the rebooking request as expired
      await rbCron
        .from("rebooking_requests")
        .update({ status: "expired" })
        .eq("id", req.id);
      expiredCount++;

      // Cancel the original appointment
      await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancellation_reason: "Doctor unavailable - patient did not respond to rebooking",
          cancelled_at: now.toISOString(),
        })
        .eq("id", req.appointment_id)
        .eq("clinic_id", req.clinic_id);
      cancelledCount++;

      // Notify the patient about cancellation
      const patientRaw = req.patients;
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
      const doctorRaw = req.doctors;
      const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;

      if (patient?.phone) {
        try {
          await sendTextMessage(
            patient.phone,
            `Hello ${patient.name}, your appointment with ${doctor?.name ?? "your doctor"} ` +
              `has been cancelled as the doctor is unavailable and we did not receive ` +
              `your rebooking response. Please contact us to schedule a new appointment.`,
          );
        } catch (err) {
          logger.warn("Failed to send cancellation notice", {
            context: "cron/rebooking-reminders",
            requestId: req.id,
            error: err,
          });
        }
      }
    }

    return apiSuccess({
      message: "Rebooking reminders processed",
      remindersSent,
      expiredCount,
      cancelledCount,
    });
  } catch (err) {
    logger.warn("Operation failed", {
      context: "cron/rebooking-reminders",
      error: err,
    });
    return apiInternalError("Failed to process rebooking reminders");
  }
}

export const GET = withSentryCron("rebooking-reminders-hourly", "0 * * * *", handler);
