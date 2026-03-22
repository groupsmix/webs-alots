import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { getPublicServices } from "@/lib/data/public";
import { withAuth } from "@/lib/with-auth";
import { findOrCreatePatient } from "@/lib/find-or-create-patient";

export const runtime = "edge";

function addInterval(date: Date, pattern: "weekly" | "biweekly" | "monthly"): Date {
  const next = new Date(date);
  if (pattern === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (pattern === "biweekly") {
    next.setDate(next.getDate() + 14);
  } else {
    // Clamp to last day of target month to prevent overflow
    // (e.g. Jan 31 + 1 month → Feb 28, not Mar 3)
    const targetMonth = next.getMonth() + 1;
    next.setMonth(targetMonth);
    if (next.getMonth() !== targetMonth % 12) {
      next.setDate(0); // Roll back to last day of previous month
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
    const body = (await request.json()) as {
      action: "create" | "cancel";
      // Create fields
      patientId?: string;
      patientName?: string;
      doctorId?: string;
      serviceId?: string;
      date?: string;
      time?: string;
      pattern?: "weekly" | "biweekly" | "monthly";
      occurrences?: number;
      isFirstVisit?: boolean;
      hasInsurance?: boolean;
      // Cancel fields
      groupId?: string;
      cancelAll?: boolean;
      appointmentId?: string;
    };

    if (body.action === "create") {
      if (!body.patientId || !body.patientName || !body.doctorId || !body.date || !body.time || !body.pattern || !body.occurrences) {
        return NextResponse.json(
          { error: "patientId, patientName, doctorId, date, time, pattern, and occurrences are required" },
          { status: 400 },
        );
      }

      const services = await getPublicServices();
      const service = body.serviceId ? services.find((s) => s.id === body.serviceId) : undefined;

      // Find or create patient
      const patientId = await findOrCreatePatient(
        supabase, clinicConfig.clinicId, body.patientId, body.patientName,
      );
      if (!patientId) {
        return NextResponse.json({ error: "Failed to resolve patient" }, { status: 500 });
      }

      const groupId = crypto.randomUUID();
      const skippedDates: string[] = [];
      let currentDate = new Date(body.date);
      const duration = service?.duration ?? clinicConfig.booking.slotDuration;
      const [h, m] = body.time.split(":").map(Number);
      const endMinutes = h * 60 + m + duration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

      // Build all appointment records first, then batch insert in a single query
      // instead of N sequential round-trips.
      const appointmentRows: Record<string, unknown>[] = [];
      let insertIndex = 0;

      for (let i = 0; i < body.occurrences; i++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const hours = clinicConfig.workingHours[dayOfWeek];

        if (!hours?.enabled) {
          skippedDates.push(dateStr);
          currentDate = addInterval(currentDate, body.pattern);
          continue;
        }

        appointmentRows.push({
          clinic_id: clinicConfig.clinicId,
          patient_id: patientId,
          doctor_id: body.doctorId,
          service_id: body.serviceId ?? null,
          appointment_date: dateStr,
          start_time: body.time,
          end_time: endTime,
          status: "scheduled",
          is_first_visit: insertIndex === 0 ? (body.isFirstVisit ?? false) : false,
          insurance_flag: body.hasInsurance ?? false,
          booking_source: "online",
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

      // Single bulk insert instead of N sequential queries
      const { data: appointments, error: batchError } = await supabase
        .from("appointments")
        .insert(appointmentRows as never[])
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
        .eq("clinic_id", clinicConfig.clinicId)
        .eq("recurrence_group_id", body.groupId);

      if (!groupAppts || groupAppts.length === 0) {
        return NextResponse.json({ error: "No appointments found for this group" }, { status: 404 });
      }

      let toCancel = groupAppts;
      if (!body.cancelAll && body.appointmentId) {
        toCancel = groupAppts.filter((a) => a.id === body.appointmentId);
      }

      const cancelIds = toCancel
        .filter((a) => a.status !== "cancelled" && a.status !== "completed")
        .map((a) => a.id);

      if (cancelIds.length > 0) {
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .in("id", cancelIds);
      }

      return NextResponse.json({
        status: "cancelled",
        message: `${cancelIds.length} appointment(s) cancelled`,
        cancelledCount: cancelIds.length,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'cancel'" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process recurring booking" }, { status: 500 });
  }
}, null);
