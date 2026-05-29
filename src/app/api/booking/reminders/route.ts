import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import type { TemplateVariables } from "@/lib/notifications";
import { requireTenantWithConfig } from "@/lib/tenant";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import type { UserRole } from "@/lib/types/database";
import { sendRemindersSchema } from "@/lib/validations/receptionist-ai";
import { withAuth } from "@/lib/with-auth";

const REMINDER_ROLES: UserRole[] = [...STAFF_ROLES];

/**
 * POST /api/booking/reminders
 *
 * Process pending reminders (24h and 2h before appointment).
 * Sends WhatsApp messages with appointment details, clinic address,
 * and any prep instructions.
 */
export const POST = withAuthValidation(
  sendRemindersSchema,
  async (body, request, { supabase }) => {
    const { tenant } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;
    const { reminderType, appointmentId, dryRun } = body;

    const now = new Date();
    let query = supabase
      .from("appointment_reminders")
      .select(
        `
        id,
        appointment_id,
        reminder_type,
        channel,
        scheduled_at,
        appointments!inner (
          id,
          appointment_date,
          slot_start,
          status,
          patient_id,
          doctor_id,
          service_id,
          clinic_id
        )
      `,
      )
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .eq("reminder_type", reminderType)
      .lte("scheduled_at", now.toISOString());

    if (appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    const { data: pendingReminders, error: fetchError } = await query.limit(50);

    if (fetchError) {
      logger.error("Failed to fetch pending reminders", {
        context: "booking/reminders",
        error: fetchError,
      });
      return apiInternalError("Failed to fetch pending reminders");
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return apiSuccess({ sent: 0, message: "No pending reminders" });
    }

    // Fetch clinic info for message variables
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name, phone, address")
      .eq("id", clinicId)
      .single();

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ reminderId: string; success: boolean; error?: string }> = [];

    for (const reminder of pendingReminders) {
      const appt = reminder.appointments as unknown as {
        id: string;
        appointment_date: string;
        slot_start: string;
        status: string;
        patient_id: string;
        doctor_id: string;
        service_id: string | null;
        clinic_id: string;
      };

      // Skip if appointment is no longer active
      if (
        appt.status === APPOINTMENT_STATUS.CANCELLED ||
        appt.status === APPOINTMENT_STATUS.RESCHEDULED ||
        appt.status === APPOINTMENT_STATUS.NO_SHOW ||
        appt.status === APPOINTMENT_STATUS.COMPLETED
      ) {
        await supabase
          .from("appointment_reminders")
          .update({ status: "failed", error_message: "Appointment no longer active" })
          .eq("id", reminder.id)
          .eq("clinic_id", clinicId);
        continue;
      }

      // Fetch patient and doctor info
      const [{ data: patient }, { data: doctor }, { data: service }] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, phone")
          .eq("id", appt.patient_id)
          .eq("clinic_id", clinicId)
          .single(),
        supabase
          .from("users")
          .select("id, name")
          .eq("id", appt.doctor_id)
          .eq("clinic_id", clinicId)
          .single(),
        appt.service_id
          ? supabase
              .from("services")
              .select("name")
              .eq("id", appt.service_id)
              .eq("clinic_id", clinicId)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      if (!patient || !doctor) {
        await supabase
          .from("appointment_reminders")
          .update({ status: "failed", error_message: "Patient or doctor not found" })
          .eq("id", reminder.id)
          .eq("clinic_id", clinicId);
        failedCount++;
        results.push({
          reminderId: reminder.id,
          success: false,
          error: "Patient or doctor not found",
        });
        continue;
      }

      if (dryRun) {
        results.push({ reminderId: reminder.id, success: true });
        sentCount++;
        continue;
      }

      const trigger = reminderType === "24h" ? ("reminder_24h" as const) : ("reminder_2h" as const);
      const variables: TemplateVariables = {
        patient_name: patient.name ?? "",
        doctor_name: doctor.name ?? "",
        clinic_name: clinic?.name ?? tenant.clinicName,
        clinic_phone: clinic?.phone ?? "",
        clinic_address: clinic?.address ?? "",
        service_name: service?.name ?? "",
        date: appt.appointment_date,
        time: appt.slot_start,
      };

      try {
        const dispatchResults = await dispatchNotification(trigger, variables, patient.id, [
          reminder.channel as "whatsapp" | "sms" | "email" | "in_app",
        ]);

        const success = dispatchResults.some((r) => r.success);

        await supabase
          .from("appointment_reminders")
          .update({
            status: success ? "sent" : "failed",
            sent_at: success ? new Date().toISOString() : null,
            error_message: success ? null : dispatchResults.map((r) => r.error).join("; "),
          })
          .eq("id", reminder.id)
          .eq("clinic_id", clinicId);

        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }

        results.push({
          reminderId: reminder.id,
          success,
          error: success ? undefined : dispatchResults.map((r) => r.error).join("; "),
        });
      } catch (err) {
        logger.error("Failed to send reminder", {
          context: "booking/reminders",
          reminderId: reminder.id,
          error: err,
        });

        await supabase
          .from("appointment_reminders")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", reminder.id)
          .eq("clinic_id", clinicId);

        failedCount++;
        results.push({
          reminderId: reminder.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    await logAuditEvent({
      supabase,
      action: "reminders.processed",
      type: "booking",
      clinicId,
      description: `Processed ${reminderType} reminders: ${sentCount} sent, ${failedCount} failed`,
    });

    return apiSuccess({
      sent: sentCount,
      failed: failedCount,
      total: pendingReminders.length,
      results,
    });
  },
  REMINDER_ROLES,
);

/**
 * GET /api/booking/reminders?status=pending&date=2024-01-01
 *
 * List reminders for the clinic, optionally filtered by status and date.
 */
export const GET = withAuth(async (request, { supabase }) => {
  const { tenant } = await requireTenantWithConfig();
  const clinicId = tenant.clinicId;

  const status = request.nextUrl.searchParams.get("status");
  const date = request.nextUrl.searchParams.get("date");

  let query = supabase
    .from("appointment_reminders")
    .select(
      `
      id,
      appointment_id,
      reminder_type,
      channel,
      status,
      scheduled_at,
      sent_at,
      error_message,
      created_at
    `,
    )
    .eq("clinic_id", clinicId)
    .order("scheduled_at", { ascending: true })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  if (date) {
    query = query.gte("scheduled_at", `${date}T00:00:00`).lte("scheduled_at", `${date}T23:59:59`);
  }

  const { data: reminders, error } = await query;

  if (error) {
    logger.error("Failed to fetch reminders", {
      context: "booking/reminders",
      error,
    });
    return apiInternalError("Failed to fetch reminders");
  }

  return apiSuccess({ reminders: reminders ?? [] });
}, REMINDER_ROLES);
