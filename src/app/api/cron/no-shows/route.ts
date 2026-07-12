import { NextRequest } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { assertClinicId } from "@/lib/assert-tenant";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { enqueueNotification } from "@/lib/notification-queue";
import { substituteVariables } from "@/lib/notifications";
import { withSentryCron } from "@/lib/sentry-cron";
import { createAdminClient } from "@/lib/supabase-server";
import { getWhatsAppTemplate } from "@/lib/whatsapp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

const CRON_WINDOW_MINUTES = 70;
const MAX_PER_RUN = 500;

async function handler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (auth) return auth;

  try {
    // nosemgrep: semgrep.admin-client-guard — cross-tenant cron sweep iterating all clinics
    const supabase = createAdminClient("cron");
    const untypedSupabase = supabase as unknown as SupabaseUntyped;
    const now = new Date();
    const windowStart = new Date(now.getTime() - CRON_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: records, error } = await supabase
      .from("no_show_records") // nosemgrep: semgrep.tenant-scoping — cross-tenant cron sweep; per-clinic dispatch happens row-by-row downstream
      .select(
        `
        id,
        clinic_id,
        patient_id,
        doctor_id,
        appointment_id,
        appointment_date,
        patients:patient_id (id, name, phone),
        doctors:doctor_id (id, name),
        clinics:clinic_id (id, name, config)
      `,
      )
      .gte("marked_at", windowStart)
      .order("marked_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      logger.warn("Failed to fetch no-show records", { context: "cron/no-shows", error });
      return apiInternalError("Failed to fetch no-show records");
    }

    let enqueued = 0;
    let skipped = 0;

    for (const record of records ?? []) {
      const clinicId = (record.clinic_id as string) ?? "";
      const appointmentId = (record.appointment_id as string) ?? "";

      try {
        assertClinicId(clinicId, "cron/no-shows:record");
      } catch {
        logger.warn("Invalid clinic_id on no-show record — skipped", {
          context: "cron/no-shows",
          recordId: record.id,
          clinicId,
        });
        continue;
      }

      // Skip if a follow-up for this appointment is already in the queue
      const { count } = await untypedSupabase
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("trigger_type", "no_show")
        .eq("clinic_id", clinicId)
        .eq("metadata->>appointment_id", appointmentId);

      if (count && count > 0) {
        skipped++;
        continue;
      }

      const patientRaw = record.patients;
      const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
      const doctorRaw = record.doctors;
      const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;
      const clinicRaw = record.clinics;
      const clinic = Array.isArray(clinicRaw) ? clinicRaw[0] : clinicRaw;

      if (!patient?.phone) continue;

      const clinicConfig = (clinic?.config ?? null) as Record<string, unknown> | null;
      const locale = (clinicConfig?.patient_message_locale as string | undefined) ?? "fr";
      const templateBody = await getWhatsAppTemplate(clinicId, "no_show", locale);
      const templateVars = {
        patient_name: patient.name ?? "",
        doctor_name: doctor?.name ?? "",
        clinic_name: (clinic?.name as string) ?? "",
        date: (record.appointment_date as string) ?? "",
        clinic_phone: "",
      };
      const body = templateBody
        ? substituteVariables(templateBody, templateVars)
        : `Bonjour ${patient.name ?? ""}, nous avons remarqué que vous n'êtes pas venu(e) à votre rendez-vous. Souhaitez-vous en reprogrammer un ? ${(clinic?.name as string) ?? ""}`;

      const queueId = await enqueueNotification({
        clinicId,
        channel: "whatsapp",
        recipient: patient.phone,
        body,
        trigger: "no_show",
        metadata: {
          recipient_id: patient.id,
          appointment_id: appointmentId,
          clinic_name: (clinic?.name as string) ?? "",
          locale,
          no_show_record_id: record.id as string,
        },
      });

      if (queueId) {
        enqueued++;
      }
    }

    return apiSuccess({
      message: "No-show follow-ups processed",
      enqueued,
      skipped,
    });
  } catch (err) {
    logger.error("No-shows cron failed", { context: "cron/no-shows", error: err });
    return apiInternalError("Failed to process no-show follow-ups");
  }
}

export const GET = withSentryCron("no-shows-follow-up", "0 * * * *", handler);
