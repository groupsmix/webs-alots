import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { sendFeedbackRequest } from "@/lib/post-appointment-feedback";
import { withSentryCron } from "@/lib/sentry-cron";
import { createClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/feedback
 *
 * Cron job that finds recently completed appointments and sends
 * post-appointment feedback requests via WhatsApp.
 *
 * Runs every hour. Only sends feedback for appointments completed
 * in the last 2 hours that haven't already received feedback.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Find completed appointments from the last 2 hours that
    // haven't received a feedback request yet
    const { data: completedAppointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        clinic_id,
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        patients:patient_id (id, name, phone),
        doctors:doctor_id (id, name),
        clinics:clinic_id (id, name, google_place_id)
      `)
      .eq("status", "completed")
      .gte("updated_at", twoHoursAgo.toISOString())
      .limit(100);

    if (error) {
      logger.error("Failed to query completed appointments", {
        context: "cron/feedback",
        error,
      });
      return apiInternalError("Failed to query appointments");
    }

    if (!completedAppointments || completedAppointments.length === 0) {
      return apiSuccess({ message: "No completed appointments to process", sent: 0 });
    }

    // Check which appointments already have feedback entries
    // patient_feedback is added by migration 00055 — cast through unknown
    const appointmentIds = completedAppointments.map((a) => a.id);
    const { data: existingFeedback } = await (supabase as unknown as { from(t: string): { select(s: string): { in(col: string, vals: string[]): Promise<{ data: { appointment_id: string }[] | null }> } } }).from("patient_feedback")
      .select("appointment_id")
      .in("appointment_id", appointmentIds);

    const alreadySent = new Set(
      (existingFeedback ?? []).map((f: { appointment_id: string }) => f.appointment_id),
    );

    const results: { appointmentId: string; success: boolean }[] = [];

    for (const appt of completedAppointments) {
      if (alreadySent.has(appt.id)) continue;

      const patientRaw = appt.patients;
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
      const doctorRaw = appt.doctors;
      const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;
      const clinicRaw = appt.clinics;
      const clinic = Array.isArray(clinicRaw) ? clinicRaw[0] : clinicRaw;

      if (!patient?.phone || !patient?.name || !clinic?.name) continue;

      const result = await sendFeedbackRequest({
        appointmentId: appt.id,
        clinicId: appt.clinic_id as string,
        clinicName: clinic.name,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor?.name ?? "Doctor",
        googlePlaceId: clinic.google_place_id,
      });

      // Create a feedback entry with null rating (pending)
      if (result.success) {
        // patient_feedback table added by migration 00055
        await (supabase as unknown as { from(t: string): { insert(row: Record<string, unknown>): Promise<void> } }).from("patient_feedback").insert({
          clinic_id: appt.clinic_id,
          appointment_id: appt.id,
          patient_id: patient.id,
          doctor_id: appt.doctor_id,
          rating: 0, // Will be updated when patient responds
          source: "whatsapp",
          feedback_sent_at: new Date().toISOString(),
          whatsapp_message_id: result.messageId ?? null,
        });
      }

      results.push({ appointmentId: appt.id, success: result.success });
    }

    return apiSuccess({
      message: `Processed ${completedAppointments.length} appointments`,
      sent: results.filter((r) => r.success).length,
      results,
    });
  } catch (err) {
    logger.error("Failed to process feedback cron", {
      context: "cron/feedback",
      error: err,
    });
    return apiInternalError("Failed to process feedback");
  }
}

export const GET = withSentryCron("feedback-hourly", "0 * * * *", handler);
