import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";
import { sendTextMessage, getWhatsAppTemplate } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/cron/nps-survey
 *
 * Auto-send NPS satisfaction survey via WhatsApp 24h after appointment completion.
 * Iterates per-clinic to maintain tenant isolation.
 * Protected by CRON_SECRET.
 */
async function handler(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient("cron");
    const untypedSupabase = supabase as unknown as SupabaseUntyped;

    // MA-04: exclude soft-deleted clinics
    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("status", "active")
      .is("deleted_at", null);

    if (clinicsError || !clinics?.length) {
      return apiSuccess({ message: "No active clinics", sent: 0 });
    }

    let totalSent = 0;
    let totalErrors = 0;

    for (const clinic of clinics) {
      assertClinicId(clinic.id, "cron/nps-survey");
      const clinicId = clinic.id;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      const { data: completedAppointments, error: apptError } = await supabase
        .from("appointments")
        .select(
          `
          id,
          patient_id,
          doctor_id,
          appointment_date,
          start_time,
          patients:patient_id (id, name, phone),
          doctors:doctor_id (id, name)
        `,
        )
        .eq("clinic_id", clinicId)
        .eq("status", "completed")
        .gte("updated_at", twentyFiveHoursAgo.toISOString())
        .lte("updated_at", twentyFourHoursAgo.toISOString());

      if (apptError || !completedAppointments?.length) {
        continue;
      }

      for (const appt of completedAppointments) {
        const patientRaw = appt.patients;
        const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
        const doctorRaw = appt.doctors;
        const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;

        if (!patient?.phone) continue;

        const { data: existing } = await untypedSupabase
          .from("nps_surveys")
          .select("id")
          .eq("appointment_id", appt.id)
          .eq("clinic_id", clinicId)
          .single();

        if (existing) continue;

        const surveyId = crypto.randomUUID();
        const { error: insertError } = await untypedSupabase.from("nps_surveys").insert({
          id: surveyId,
          clinic_id: clinicId,
          appointment_id: appt.id,
          patient_id: appt.patient_id,
          doctor_id: appt.doctor_id,
          sent_at: new Date().toISOString(),
        });

        if (insertError) {
          logger.error("Failed to create NPS survey", {
            context: "cron/nps-survey",
            clinicId,
            error: insertError,
          });
          totalErrors++;
          continue;
        }

        const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/nps?id=${surveyId}`;
        const templateBody = await getWhatsAppTemplate(clinicId, "nps_survey");
        const messageBody =
          templateBody
            ?.replace("{{patient_name}}", patient.name ?? "")
            .replace("{{doctor_name}}", doctor?.name ?? "")
            .replace("{{clinic_name}}", clinic.name ?? "")
            .replace("{{survey_url}}", surveyUrl) ??
          `مرحبا ${patient.name ?? ""}, كيف كانت تجربتك مع الدكتور ${doctor?.name ?? ""}؟ شاركنا رأيك: ${surveyUrl} — ${clinic.name ?? ""}`;

        const result = await sendTextMessage(patient.phone, messageBody);

        if (result.success) {
          await untypedSupabase
            .from("nps_surveys")
            .update({ whatsapp_message_id: result.messageId })
            .eq("id", surveyId)
            .eq("clinic_id", clinicId);
          totalSent++;
        } else {
          logger.warn("Failed to send NPS WhatsApp", {
            context: "cron/nps-survey",
            clinicId,
            error: result.error,
          });
          totalErrors++;
        }
      }
    }

    return apiSuccess({
      message: "NPS surveys processed",
      sent: totalSent,
      errors: totalErrors,
    });
  } catch (err) {
    logger.error("NPS survey cron failed", {
      context: "cron/nps-survey",
      error: err,
    });
    return apiInternalError("Failed to process NPS surveys");
  }
}

export const GET = withSentryCron("nps-survey-daily", "0 * * * *", handler);
