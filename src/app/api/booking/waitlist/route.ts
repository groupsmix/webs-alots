import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import type { TemplateVariables } from "@/lib/notifications";
import { requireTenantWithConfig } from "@/lib/tenant";
import { computeEndTime } from "@/lib/timezone";
import { APPOINTMENT_STATUS, BOOKING_SOURCE, WAITING_LIST_STATUS } from "@/lib/types/database";
import type { UserRole } from "@/lib/types/database";
import {
  waitlistAddSchema,
  waitlistNotifySchema,
  waitlistPromoteSchema,
} from "@/lib/validations/receptionist-ai";
import { withAuth } from "@/lib/with-auth";

const WAITLIST_ROLES: UserRole[] = [...STAFF_ROLES, "patient"];

/**
 * POST /api/booking/waitlist
 *
 * Add a patient to the waitlist with priority scoring.
 * Priority queue considers urgency and wait time.
 */
export const POST = withAuthValidation(
  waitlistAddSchema,
  async (body, request, { supabase }) => {
    const { tenant } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    const {
      patientId,
      patientName,
      patientPhone,
      doctorId,
      serviceId,
      preferredDate,
      preferredTime,
      urgency,
      notes,
    } = body;

    const resolvedPatientId = await findOrCreatePatient(
      supabase,
      clinicId,
      patientId,
      patientName,
      { phone: patientPhone },
    );

    if (!resolvedPatientId) {
      return apiInternalError("Failed to resolve patient");
    }

    // Calculate priority score based on urgency and other factors
    const priorityScore = calculatePriorityScore(urgency ?? "normal");

    const { data: entry, error } = await supabase
      .from("waiting_list")
      .insert({
        clinic_id: clinicId,
        patient_id: resolvedPatientId,
        doctor_id: doctorId,
        service_id: serviceId ?? null,
        preferred_date: preferredDate,
        preferred_time: preferredTime ?? null,
        urgency: urgency ?? "normal",
        notes: notes ?? null,
        priority_score: priorityScore,
        status: WAITING_LIST_STATUS.WAITING,
      })
      .select("id")
      .single();

    if (error || !entry) {
      logger.error("Failed to add to waitlist", {
        context: "booking/waitlist",
        error,
      });
      return apiInternalError("Failed to add to waitlist");
    }

    await logAuditEvent({
      supabase,
      action: "waitlist.added",
      type: "booking",
      clinicId,
      description: `Patient ${resolvedPatientId} added to waitlist (entry ${entry.id}) for doctor ${doctorId} on ${preferredDate}, urgency: ${urgency ?? "normal"}`,
    });

    return apiSuccess({
      entryId: entry.id,
      priorityScore,
      position: await getWaitlistPosition(supabase, clinicId, doctorId, preferredDate, entry.id),
    });
  },
  WAITLIST_ROLES,
);

/**
 * GET /api/booking/waitlist?doctorId=...&date=...
 *
 * Get waitlist entries sorted by priority (urgency + wait time).
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  const { tenant } = await requireTenantWithConfig();
  const clinicId = tenant.clinicId;

  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const date = request.nextUrl.searchParams.get("date");
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("waiting_list")
    .select(
      `
      id,
      patient_id,
      doctor_id,
      service_id,
      preferred_date,
      preferred_time,
      urgency,
      priority_score,
      notes,
      status,
      notified_at,
      created_at
    `,
    )
    .eq("clinic_id", clinicId)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true });

  // Patients can only view their own entries
  if (profile.role === "patient") {
    query = query.eq("patient_id", profile.id);
  }

  if (doctorId) {
    query = query.eq("doctor_id", doctorId);
  }

  if (date) {
    query = query.eq("preferred_date", date);
  }

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.eq("status", WAITING_LIST_STATUS.WAITING);
  }

  const { data: entries, error } = await query.limit(100);

  if (error) {
    logger.error("Failed to fetch waitlist", {
      context: "booking/waitlist",
      error,
    });
    return apiInternalError("Failed to fetch waitlist");
  }

  return apiSuccess({ entries: entries ?? [] });
}, WAITLIST_ROLES);

/**
 * PATCH /api/booking/waitlist
 *
 * Notify a waitlist entry that a slot is available.
 */
export const PATCH = withAuthValidation(
  waitlistNotifySchema,
  async (body, request, { supabase }) => {
    const { tenant } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;
    const { entryId, availableDate, availableTime } = body;

    // Fetch the waitlist entry
    const { data: entry, error: fetchError } = await supabase
      .from("waiting_list")
      .select("id, patient_id, doctor_id, status")
      .eq("id", entryId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !entry) {
      return apiError("Waitlist entry not found", 404, "NOT_FOUND");
    }

    if (entry.status !== WAITING_LIST_STATUS.WAITING) {
      return apiError("Entry is not in waiting status", 400, "INVALID_STATUS");
    }

    // Update status to notified
    const { error: updateError } = await supabase
      .from("waiting_list")
      .update({
        status: WAITING_LIST_STATUS.NOTIFIED,
        notified_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .eq("clinic_id", clinicId);

    if (updateError) {
      logger.error("Failed to update waitlist entry", {
        context: "booking/waitlist",
        error: updateError,
      });
      return apiInternalError("Failed to update waitlist entry");
    }

    // Fetch patient and doctor details for notification
    const [{ data: patient }, { data: doctor }, { data: clinic }] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, phone")
        .eq("id", entry.patient_id)
        .eq("clinic_id", clinicId)
        .single(),
      supabase
        .from("users")
        .select("id, name")
        .eq("id", entry.doctor_id)
        .eq("clinic_id", clinicId)
        .single(),
      supabase.from("clinics").select("name, phone, address").eq("id", clinicId).single(),
    ]);

    if (patient) {
      const variables: TemplateVariables = {
        patient_name: patient.name ?? "",
        doctor_name: doctor?.name ?? "",
        clinic_name: clinic?.name ?? tenant.clinicName,
        clinic_phone: clinic?.phone ?? "",
        clinic_address: clinic?.address ?? "",
        date: availableDate,
        time: availableTime,
      };

      try {
        await dispatchNotification("rescheduled", variables, patient.id, ["whatsapp", "in_app"]);
      } catch (err) {
        logger.error("Failed to notify waitlist patient", {
          context: "booking/waitlist",
          error: err,
        });
      }
    }

    await logAuditEvent({
      supabase,
      action: "waitlist.notified",
      type: "booking",
      clinicId,
      description: `Waitlist entry ${entryId} notified about available slot on ${availableDate} at ${availableTime}`,
    });

    return apiSuccess({ entryId, status: "notified" });
  },
  STAFF_ROLES,
);

/**
 * PUT /api/booking/waitlist
 *
 * Promote a waitlist entry to a booked appointment.
 */
export const PUT = withAuthValidation(
  waitlistPromoteSchema,
  async (body, request, { supabase }) => {
    const { tenant } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;
    const { entryId, date, time, slotDuration } = body;

    // Fetch the waitlist entry
    const { data: entry, error: fetchError } = await supabase
      .from("waiting_list")
      .select("id, patient_id, doctor_id, service_id, status")
      .eq("id", entryId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !entry) {
      return apiError("Waitlist entry not found", 404, "NOT_FOUND");
    }

    if (
      entry.status !== WAITING_LIST_STATUS.WAITING &&
      entry.status !== WAITING_LIST_STATUS.NOTIFIED
    ) {
      return apiError("Entry cannot be promoted from current status", 400, "INVALID_STATUS");
    }

    const { endTime: slotEnd } = computeEndTime(time, slotDuration);

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", entry.doctor_id)
      .eq("appointment_date", date)
      .lt("slot_start", slotEnd)
      .gt("slot_end", time)
      .not("status", "in", `(${APPOINTMENT_STATUS.CANCELLED},${APPOINTMENT_STATUS.RESCHEDULED})`)
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return apiError("Slot is no longer available", 409, "SLOT_CONFLICT");
    }

    // Create the appointment
    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: entry.doctor_id,
        patient_id: entry.patient_id,
        service_id: entry.service_id,
        appointment_date: date,
        slot_start: time,
        slot_end: slotEnd,
        start_time: time,
        end_time: slotEnd,
        status: APPOINTMENT_STATUS.SCHEDULED,
        booking_source: BOOKING_SOURCE.PHONE,
      })
      .select("id")
      .single();

    if (apptError || !appointment) {
      logger.error("Failed to create appointment from waitlist", {
        context: "booking/waitlist",
        error: apptError,
      });
      return apiInternalError("Failed to create appointment");
    }

    // Update waitlist entry to booked
    await supabase
      .from("waiting_list")
      .update({ status: WAITING_LIST_STATUS.BOOKED })
      .eq("id", entryId)
      .eq("clinic_id", clinicId);

    // Schedule reminders
    const appointmentDateTime = new Date(`${date}T${time}:00`);
    const now = new Date();
    const reminders: Array<{
      clinic_id: string;
      appointment_id: string;
      reminder_type: string;
      channel: string;
      status: string;
      scheduled_at: string;
    }> = [];

    const reminder24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    const reminder2h = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);

    if (reminder24h > now) {
      reminders.push({
        clinic_id: clinicId,
        appointment_id: appointment.id,
        reminder_type: "24h",
        channel: "whatsapp",
        status: "pending",
        scheduled_at: reminder24h.toISOString(),
      });
    }

    if (reminder2h > now) {
      reminders.push({
        clinic_id: clinicId,
        appointment_id: appointment.id,
        reminder_type: "2h",
        channel: "whatsapp",
        status: "pending",
        scheduled_at: reminder2h.toISOString(),
      });
    }

    if (reminders.length > 0) {
      await supabase.from("appointment_reminders").insert(reminders);
    }

    await logAuditEvent({
      supabase,
      action: "waitlist.promoted",
      type: "booking",
      clinicId,
      description: `Waitlist entry ${entryId} promoted to appointment ${appointment.id} on ${date} at ${time}`,
    });

    return apiSuccess({
      appointmentId: appointment.id,
      entryId,
      date,
      time,
      slotEnd,
    });
  },
  STAFF_ROLES,
);

function calculatePriorityScore(urgency: string): number {
  const urgencyScores: Record<string, number> = {
    low: 10,
    normal: 30,
    high: 60,
    urgent: 90,
  };
  return urgencyScores[urgency] ?? 30;
}

async function getWaitlistPosition(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  clinicId: string,
  doctorId: string,
  preferredDate: string,
  entryId: string,
): Promise<number> {
  const { data: entries } = await supabase
    .from("waiting_list")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .eq("preferred_date", preferredDate)
    .eq("status", WAITING_LIST_STATUS.WAITING)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true });

  if (!entries) return 1;
  const index = entries.findIndex((e) => e.id === entryId);
  return index >= 0 ? index + 1 : entries.length + 1;
}
