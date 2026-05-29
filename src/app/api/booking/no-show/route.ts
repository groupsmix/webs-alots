import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import type { TemplateVariables } from "@/lib/notifications";
import { requireTenantWithConfig } from "@/lib/tenant";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import type { UserRole } from "@/lib/types/database";
import { noShowMarkSchema } from "@/lib/validations/receptionist-ai";
import { withAuth } from "@/lib/with-auth";

const NO_SHOW_ROLES: UserRole[] = [...STAFF_ROLES];

/**
 * POST /api/booking/no-show
 *
 * Mark an appointment as no-show and update tracking stats.
 * Flags repeat offenders and suggests overbooking for high no-show doctors.
 */
export const POST = withAuthValidation(
  noShowMarkSchema,
  async (body, request, { supabase }) => {
    const { tenant } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;
    const { appointmentId, reason } = body;

    // Fetch the appointment
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("id, patient_id, doctor_id, appointment_date, slot_start, status, clinic_id")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .single();

    if (fetchError || !appointment) {
      return apiError("Appointment not found", 404, "NOT_FOUND");
    }

    if (appointment.status === APPOINTMENT_STATUS.NO_SHOW) {
      return apiError("Appointment is already marked as no-show", 400, "ALREADY_MARKED");
    }

    if (
      appointment.status === APPOINTMENT_STATUS.CANCELLED ||
      appointment.status === APPOINTMENT_STATUS.COMPLETED
    ) {
      return apiError(
        "Cannot mark a cancelled or completed appointment as no-show",
        400,
        "INVALID_STATUS",
      );
    }

    // Update appointment status
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: APPOINTMENT_STATUS.NO_SHOW })
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);

    if (updateError) {
      logger.error("Failed to update appointment status", {
        context: "booking/no-show",
        error: updateError,
      });
      return apiInternalError("Failed to mark as no-show");
    }

    // Record the no-show
    const { error: recordError } = await supabase.from("no_show_records").insert({
      clinic_id: clinicId,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appointment_id: appointmentId,
      appointment_date: appointment.appointment_date ?? new Date().toISOString().split("T")[0],
      reason: reason ?? null,
    });

    if (recordError) {
      logger.error("Failed to record no-show", {
        context: "booking/no-show",
        error: recordError,
      });
    }

    // Update patient no-show stats
    const patientStats = await updatePatientNoShowStats(supabase, clinicId, appointment.patient_id);

    // Update doctor no-show stats
    await updateDoctorNoShowStats(supabase, clinicId, appointment.doctor_id);

    // Notify waitlist entries for this doctor on this date
    const { data: waitlistEntries } = await supabase
      .from("waiting_list")
      .select("id, patient_id")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", appointment.doctor_id)
      .eq("preferred_date", appointment.appointment_date ?? "")
      .eq("status", "waiting")
      .order("priority_score", { ascending: false })
      .limit(3);

    const notifiedWaitlist: string[] = [];
    if (waitlistEntries && waitlistEntries.length > 0) {
      // Fetch clinic info for notification
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name, phone, address")
        .eq("id", clinicId)
        .single();

      const { data: doctor } = await supabase
        .from("users")
        .select("name")
        .eq("id", appointment.doctor_id)
        .eq("clinic_id", clinicId)
        .single();

      for (const wlEntry of waitlistEntries) {
        const { data: patient } = await supabase
          .from("users")
          .select("id, name")
          .eq("id", wlEntry.patient_id)
          .eq("clinic_id", clinicId)
          .single();

        if (patient) {
          const variables: TemplateVariables = {
            patient_name: patient.name ?? "",
            doctor_name: doctor?.name ?? "",
            clinic_name: clinic?.name ?? tenant.clinicName,
            clinic_phone: clinic?.phone ?? "",
            date: appointment.appointment_date ?? "",
            time: appointment.slot_start ?? "",
          };

          try {
            await dispatchNotification("rescheduled", variables, patient.id, [
              "whatsapp",
              "in_app",
            ]);
            notifiedWaitlist.push(wlEntry.id);

            await supabase
              .from("waiting_list")
              .update({
                status: "notified",
                notified_at: new Date().toISOString(),
              })
              .eq("id", wlEntry.id)
              .eq("clinic_id", clinicId);
          } catch (err) {
            logger.error("Failed to notify waitlist entry on no-show", {
              context: "booking/no-show",
              error: err,
            });
          }
        }
      }
    }

    // Send no-show notification to patient
    try {
      const [{ data: patient }, { data: doctor }, { data: clinic }] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, phone")
          .eq("id", appointment.patient_id)
          .eq("clinic_id", clinicId)
          .single(),
        supabase
          .from("users")
          .select("name")
          .eq("id", appointment.doctor_id)
          .eq("clinic_id", clinicId)
          .single(),
        supabase.from("clinics").select("name, phone").eq("id", clinicId).single(),
      ]);

      if (patient) {
        const variables: TemplateVariables = {
          patient_name: patient.name ?? "",
          doctor_name: doctor?.name ?? "",
          clinic_name: clinic?.name ?? tenant.clinicName,
          clinic_phone: clinic?.phone ?? "",
          date: appointment.appointment_date ?? "",
          time: appointment.slot_start ?? "",
        };

        await dispatchNotification("no_show", variables, patient.id, ["whatsapp", "in_app"]);
      }
    } catch (err) {
      logger.error("Failed to send no-show notification", {
        context: "booking/no-show",
        error: err,
      });
    }

    await logAuditEvent({
      supabase,
      action: "appointment.no_show",
      type: "booking",
      clinicId,
      description: `Appointment ${appointmentId} marked as no-show for patient ${appointment.patient_id}`,
    });

    return apiSuccess({
      appointmentId,
      status: "no_show",
      patientStats: patientStats
        ? {
            totalNoShows: patientStats.totalNoShows,
            noShowRate: patientStats.noShowRate,
            isFlagged: patientStats.isFlagged,
          }
        : null,
      waitlistNotified: notifiedWaitlist.length,
    });
  },
  NO_SHOW_ROLES,
);

/**
 * GET /api/booking/no-show?doctorId=...&startDate=...&endDate=...
 *
 * Get no-show analytics: rates per doctor, flagged patients, overbooking suggestions.
 */
export const GET = withAuth(async (request, { supabase }) => {
  const { tenant } = await requireTenantWithConfig();
  const clinicId = tenant.clinicId;

  const doctorId = request.nextUrl.searchParams.get("doctorId");
  const patientId = request.nextUrl.searchParams.get("patientId");
  const view = request.nextUrl.searchParams.get("view") ?? "summary";

  if (view === "flagged-patients") {
    const { data: flagged } = await supabase
      .from("no_show_stats")
      .select("patient_id, total_no_shows, total_appointments, no_show_rate, last_no_show_at")
      .eq("clinic_id", clinicId)
      .eq("is_flagged", true)
      .order("no_show_rate", { ascending: false })
      .limit(50);

    return apiSuccess({ flaggedPatients: flagged ?? [] });
  }

  if (view === "doctor-stats") {
    let query = supabase
      .from("doctor_no_show_stats")
      .select(
        "doctor_id, total_no_shows, total_appointments, no_show_rate, suggested_overbooking_pct, updated_at",
      )
      .eq("clinic_id", clinicId)
      .order("no_show_rate", { ascending: false });

    if (doctorId) {
      query = query.eq("doctor_id", doctorId);
    }

    const { data: doctorStats } = await query.limit(50);

    return apiSuccess({ doctorStats: doctorStats ?? [] });
  }

  if (view === "patient-history" && patientId) {
    const { data: records } = await supabase
      .from("no_show_records")
      .select("id, appointment_id, appointment_date, doctor_id, reason, marked_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("marked_at", { ascending: false })
      .limit(50);

    const { data: stats } = await supabase
      .from("no_show_stats")
      .select("total_no_shows, total_appointments, no_show_rate, is_flagged, last_no_show_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .single();

    return apiSuccess({
      records: records ?? [],
      stats: stats ?? null,
    });
  }

  // Default: summary view
  const { data: totalNoShows } = await supabase
    .from("no_show_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  const { data: flaggedCount } = await supabase
    .from("no_show_stats")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("is_flagged", true);

  const { data: doctorStats } = await supabase
    .from("doctor_no_show_stats")
    .select("doctor_id, no_show_rate, suggested_overbooking_pct")
    .eq("clinic_id", clinicId)
    .order("no_show_rate", { ascending: false })
    .limit(5);

  return apiSuccess({
    summary: {
      totalNoShows: (totalNoShows as unknown as { count: number })?.count ?? 0,
      flaggedPatients: (flaggedCount as unknown as { count: number })?.count ?? 0,
      topDoctorsByNoShowRate: doctorStats ?? [],
    },
  });
}, NO_SHOW_ROLES);

async function updatePatientNoShowStats(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  clinicId: string,
  patientId: string,
): Promise<{ totalNoShows: number; noShowRate: number; isFlagged: boolean } | null> {
  // Count total appointments
  const { count: totalAppts } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  // Count no-shows
  const { count: totalNoShows } = await supabase
    .from("no_show_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  const total = totalAppts ?? 0;
  const noShows = totalNoShows ?? 0;
  const rate = total > 0 ? Math.round((noShows / total) * 10000) / 100 : 0;
  // Flag patients with 3+ no-shows or >30% rate
  const isFlagged = noShows >= 3 || rate > 30;

  const { error } = await supabase.from("no_show_stats").upsert(
    {
      clinic_id: clinicId,
      patient_id: patientId,
      total_no_shows: noShows,
      total_appointments: total,
      no_show_rate: rate,
      is_flagged: isFlagged,
      last_no_show_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,patient_id" },
  );

  if (error) {
    logger.error("Failed to update patient no-show stats", {
      context: "booking/no-show",
      error,
    });
    return null;
  }

  return { totalNoShows: noShows, noShowRate: rate, isFlagged };
}

async function updateDoctorNoShowStats(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  clinicId: string,
  doctorId: string,
): Promise<void> {
  // Count total appointments for this doctor
  const { count: totalAppts } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId);

  // Count no-shows for this doctor
  const { count: totalNoShows } = await supabase
    .from("no_show_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId);

  const total = totalAppts ?? 0;
  const noShows = totalNoShows ?? 0;
  const rate = total > 0 ? Math.round((noShows / total) * 10000) / 100 : 0;
  // Suggest overbooking percentage based on no-show rate (capped at 20%)
  const suggestedOverbooking = Math.min(Math.round(rate * 0.5 * 100) / 100, 20);

  const { error } = await supabase.from("doctor_no_show_stats").upsert(
    {
      clinic_id: clinicId,
      doctor_id: doctorId,
      total_no_shows: noShows,
      total_appointments: total,
      no_show_rate: rate,
      suggested_overbooking_pct: suggestedOverbooking,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,doctor_id" },
  );

  if (error) {
    logger.error("Failed to update doctor no-show stats", {
      context: "booking/no-show",
      error,
    });
  }
}
