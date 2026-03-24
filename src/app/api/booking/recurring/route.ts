import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { requireTenant } from "@/lib/tenant";
import { getPublicServices } from "@/lib/data/public";
import { withAuth } from "@/lib/with-auth";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";
import { APPOINTMENT_STATUS, BOOKING_SOURCE } from "@/lib/types/database";
import type { TablesInsert } from "@/lib/types/database";
import { computeEndTime } from "@/lib/timezone";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { recurringSchema, safeParse } from "@/lib/validations";

export const runtime = "edge";

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
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(recurringSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;

    if (body.action === "create") {

      // Input length validation to prevent DoS via oversized payloads
      if (body.patientName.length > 200 || (body.patientPhone && body.patientPhone.length > 30)) {
        return NextResponse.json({ error: "Input exceeds maximum allowed length" }, { status: 400 });
      }

      // FIX (MED-04): Validate occurrences against clinic config limit
      // to prevent unbounded recurring booking creation.
      const maxOccurrences = clinicConfig.booking.maxRecurringWeeks;
      if (body.occurrences < 1 || body.occurrences > maxOccurrences) {
        return NextResponse.json(
          { error: `occurrences must be between 1 and ${maxOccurrences}` },
          { status: 400 },
        );
      }

      const services = await getPublicServices();
      const service = body.serviceId ? services.find((s) => s.id === body.serviceId) : undefined;

      // Find or create patient (prefer phone-based lookup to avoid name collisions)
      const patientId = await findOrCreatePatient(
        supabase, clinicId, body.patientId, body.patientName,
        { phone: body.patientPhone },
      );
      if (!patientId) {
        return NextResponse.json({ error: "Failed to resolve patient" }, { status: 500 });
      }

      const groupId = crypto.randomUUID();
      const skippedDates: string[] = [];
      // Use noon-based parsing to avoid UTC day-of-week issues near midnight
      let currentDate = new Date(body.date + "T12:00:00");
      const duration = service?.duration ?? clinicConfig.booking.slotDuration;
      const { endTime, overflows } = computeEndTime(body.time, duration);
      if (overflows) {
        return NextResponse.json(
          { error: "Appointment would extend past midnight. Please choose an earlier time or shorter duration." },
          { status: 400 },
        );
      }

      // Build all appointment records first, then batch insert in a single query
      // instead of N sequential round-trips.
      const appointmentRows: TablesInsert<"appointments">[] = [];
      let insertIndex = 0;

      for (let i = 0; i < body.occurrences; i++) {
        // Use noon-based date to safely extract day-of-week regardless of timezone
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const hours = clinicConfig.workingHours[dayOfWeek];

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
        return NextResponse.json({ error: "No appointments could be created", success: false }, { status: 400 });
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
        return NextResponse.json({
          error: "All dates conflict with existing appointments",
          success: false,
          skippedDates,
        }, { status: 409 });
      }

      // Single bulk insert instead of N sequential queries
      const { data: appointments, error: batchError } = await supabase
        .from("appointments")
        .insert(appointmentRows)
        .select("id");

      if (batchError || !appointments || appointments.length === 0) {
        return NextResponse.json({ error: "Failed to create recurring appointments" }, { status: 500 });
      }

      const appointmentIds = appointments.map((a) => a.id);

      return NextResponse.json({
        status: "created",
        message: `Recurring booking created (${appointmentIds.length} appointments)`,
        appointmentIds,
        skippedDates,
      });
    }

    if (body.action === "cancel") {
      if (!body.groupId) {
        return NextResponse.json({ error: "groupId is required" }, { status: 400 });
      }

      // Find appointments in the group by recurrence_group_id column
      const { data: groupAppts } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("clinic_id", clinicId)
        .eq("recurrence_group_id", body.groupId);

      if (!groupAppts || groupAppts.length === 0) {
        return NextResponse.json({ error: "No appointments found for this group" }, { status: 404 });
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

      return NextResponse.json({
        status: APPOINTMENT_STATUS.CANCELLED,
        message: `${cancelIds.length} appointment(s) cancelled`,
        cancelledCount: cancelIds.length,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'cancel'" }, { status: 400 });
  } catch (err) {
    logger.warn("Operation failed", { context: "booking/recurring", error: err });
    return NextResponse.json({ error: "Failed to process recurring booking" }, { status: 500 });
  }
}, STAFF_ROLES);
