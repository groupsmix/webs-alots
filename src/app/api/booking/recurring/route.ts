import { requireTenantWithConfig } from "@/lib/tenant";
import { getPublicServices } from "@/lib/data/public";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { APPOINTMENT_STATUS, BOOKING_SOURCE } from "@/lib/types/database";
import type { TablesInsert } from "@/lib/types/database";
import { computeEndTime } from "@/lib/timezone";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { recurringSchema } from "@/lib/validations";
import { withAuthValidation } from "@/lib/api-validate";
import { apiError, apiInternalError, apiNotFound, apiSuccess } from "@/lib/api-response";
function addInterval(date: Date, pattern: "weekly" | "biweekly" | "monthly"): Date {
  const next = new Date(date);
  if (pattern === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (pattern === "biweekly") {
    next.setUTCDate(next.getUTCDate() + 14);
  } else {
    // Clamp to last day of target month to prevent overflow
    // (e.g. Jan 31 + 1 month → Feb 28, not Mar 3)
    // Use UTC methods to avoid local-timezone DST issues
    const targetMonth = next.getUTCMonth() + 1;
    next.setUTCMonth(targetMonth);
    if (next.getUTCMonth() !== targetMonth % 12) {
      next.setUTCDate(0); // Roll back to last day of previous month
    }
  }
  return next;
}

/**
 * POST /api/booking/recurring
 *
 * Create a recurring booking series or cancel one.
 */
export const POST = withAuthValidation(recurringSchema, async (body, request, { supabase }) => {

    const { tenant, config: tenantConfig } = await requireTenantWithConfig();
    const clinicId = tenant.clinicId;

    if (body.action === "create") {

      // Input length validation to prevent DoS via oversized payloads
      if (body.patientName.length > 200 || (body.patientPhone && body.patientPhone.length > 30)) {
        return apiError("Input exceeds maximum allowed length");
      }

      // FIX (MED-04): Validate occurrences against clinic config limit
      // to prevent unbounded recurring booking creation.
      const maxOccurrences = tenantConfig.booking.maxRecurringWeeks;
      if (body.occurrences < 1 || body.occurrences > maxOccurrences) {
        return apiError(`occurrences must be between 1 and ${maxOccurrences}`);
      }

      const services = await getPublicServices();
      const service = body.serviceId ? services.find((s) => s.id === body.serviceId) : undefined;

      // Find or create patient (prefer phone-based lookup to avoid name collisions)
      const patientId = await findOrCreatePatient(
        supabase, clinicId, body.patientId, body.patientName,
        { phone: body.patientPhone },
      );
      if (!patientId) {
        return apiInternalError("Failed to resolve patient");
      }

      const groupId = crypto.randomUUID();
      const skippedDates: string[] = [];
      // Use noon-based parsing to avoid UTC day-of-week issues near midnight
      let currentDate = new Date(body.date + "T12:00:00");
      const duration = service?.duration ?? tenantConfig.booking.slotDuration;
      const { endTime, overflows } = computeEndTime(body.time, duration);
      if (overflows) {
        return apiError("Appointment would extend past midnight. Please choose an earlier time or shorter duration.");
      }

      // Build all appointment records first, then batch insert in a single query
      // instead of N sequential round-trips.
      const appointmentRows: TablesInsert<"appointments">[] = [];
      let insertIndex = 0;

      for (let i = 0; i < body.occurrences; i++) {
        // Use noon-based date to safely extract day-of-week regardless of timezone
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const hours = tenantConfig.workingHours[dayOfWeek];

        if (!hours?.enabled) {
          skippedDates.push(dateStr);
          currentDate = addInterval(currentDate, body.pattern);
          continue;
        }

        const slotStart = `${dateStr}T${body.time}:00`;
        const slotEnd = `${dateStr}T${endTime}:00`;

        appointmentRows.push({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_id: body.doctorId,
          service_id: body.serviceId ?? null,
          appointment_date: dateStr,
          start_time: body.time,
          end_time: endTime,
          slot_start: slotStart,
          slot_end: slotEnd,
          status: APPOINTMENT_STATUS.SCHEDULED,
          is_first_visit: insertIndex === 0 ? (body.isFirstVisit ?? false) : false,
          insurance_flag: body.hasInsurance ?? false,
          booking_source: BOOKING_SOURCE.ONLINE,
          recurrence_group_id: groupId,
          notes: `Recurring: ${body.pattern} (${insertIndex + 1}/${body.occurrences})`,
          is_emergency: false,
        });
        insertIndex++;

        currentDate = addInterval(currentDate, body.pattern);
      }

      if (appointmentRows.length === 0) {
        return apiError("No appointments could be created");
      }

      // Check for conflicts with existing appointments before inserting
      const datesToCheck = appointmentRows.map((r) => r.appointment_date as string);
      const { data: existingAppts } = await supabase
        .from("appointments")
        .select("appointment_date, start_time, end_time")
        .eq("clinic_id", clinicId)
        .eq("doctor_id", body.doctorId)
        .in("appointment_date", datesToCheck)
        .neq("status", APPOINTMENT_STATUS.CANCELLED);

      if (existingAppts && existingAppts.length > 0) {
        // Filter out rows that conflict with existing appointments
        const conflictDates = new Set<string>();
        for (const existing of existingAppts) {
          for (const row of appointmentRows) {
            if (
              row.appointment_date === existing.appointment_date &&
              row.start_time! < existing.end_time! &&
              row.end_time! > existing.start_time!
            ) {
              conflictDates.add(row.appointment_date as string);
            }
          }
        }
        if (conflictDates.size > 0) {
          // Remove conflicting rows and add to skippedDates
          const filtered = appointmentRows.filter((r) => !conflictDates.has(r.appointment_date as string));
          skippedDates.push(...conflictDates);
          appointmentRows.length = 0;
          appointmentRows.push(...filtered);
        }
      }

      if (appointmentRows.length === 0) {
        return apiError("All dates conflict with existing appointments", 409);
      }

      // Single bulk insert instead of N sequential queries
      const { data: appointments, error: batchError } = await supabase
        .from("appointments")
        .insert(appointmentRows)
        .select("id");

      if (batchError || !appointments || appointments.length === 0) {
        return apiInternalError("Failed to create recurring appointments");
      }

      const appointmentIds = appointments.map((a) => a.id);

      return apiSuccess({
        status: "created",
        message: `Recurring booking created (${appointmentIds.length} appointments)`,
        appointmentIds,
        skippedDates,
      });
    }

    if (body.action === "cancel") {
      if (!body.groupId) {
        return apiError("groupId is required");
      }

      // Find appointments in the group by recurrence_group_id column
      const { data: groupAppts } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("clinic_id", clinicId)
        .eq("recurrence_group_id", body.groupId);

      if (!groupAppts || groupAppts.length === 0) {
        return apiNotFound("No appointments found for this group");
      }

      let toCancel = groupAppts;
      if (!body.cancelAll && body.appointmentId) {
        toCancel = groupAppts.filter((a) => a.id === body.appointmentId);
      }

      const cancelIds = toCancel
        .filter((a) => a.status !== APPOINTMENT_STATUS.CANCELLED && a.status !== APPOINTMENT_STATUS.COMPLETED)
        .map((a) => a.id);

      if (cancelIds.length > 0) {
        await supabase
          .from("appointments")
          .update({ status: APPOINTMENT_STATUS.CANCELLED })
          .in("id", cancelIds);
      }

      return apiSuccess({
        status: APPOINTMENT_STATUS.CANCELLED,
        message: `${cancelIds.length} appointment(s) cancelled`,
        cancelledCount: cancelIds.length,
      });
    }

    return apiError("action must be 'create' or 'cancel'");
}, STAFF_ROLES);
