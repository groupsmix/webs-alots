import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { getPublicServices } from "@/lib/data/public";
import { withAuth } from "@/lib/with-auth";

export const runtime = "edge";

function addInterval(date: Date, pattern: "weekly" | "biweekly" | "monthly"): Date {
  const next = new Date(date);
  if (pattern === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (pattern === "biweekly") {
    next.setDate(next.getDate() + 14);
  } else {
    // Monthly: clamp the day to the last day of the target month to avoid
    // overflow (e.g. Jan 31 → Feb 28 instead of Mar 3).
    const targetMonth = next.getMonth() + 1;
    next.setMonth(targetMonth);
    if (next.getMonth() !== targetMonth % 12) {
      // Overflowed into the next month — set to last day of target month
      next.setDate(0);
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
      patientPhone?: string;
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

      // Find or create patient (use phone for lookup to avoid name collisions)
      let patientId = body.patientId;
      if (patientId.startsWith("patient-")) {
        const lookupQuery = supabase
          .from("users")
          .select("id")
          .eq("clinic_id", clinicConfig.clinicId)
          .eq("role", "patient");

        const { data: existing } = body.patientPhone
          ? await lookupQuery.eq("phone", body.patientPhone).single()
          : await lookupQuery.eq("name", body.patientName!).limit(1).single();

        if (existing) {
          patientId = existing.id;
        } else {
          const { data: newPatient } = await supabase
            .from("users")
            .insert({
              clinic_id: clinicConfig.clinicId,
              name: body.patientName,
              phone: body.patientPhone ?? null,
              role: "patient",
            })
            .select("id")
            .single();
          if (newPatient) patientId = newPatient.id;
        }
      }

      const groupId = crypto.randomUUID();
      const appointmentIds: string[] = [];
      const skippedDates: string[] = [];
      let currentDate = new Date(body.date);
      const duration = service?.duration ?? clinicConfig.booking.slotDuration;
      const [h, m] = body.time.split(":").map(Number);
      const endMinutes = h * 60 + m + duration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

      // Build all valid appointment rows first, then insert in a single batch
      const rows: Record<string, unknown>[] = [];
      let seqIndex = 0;
      for (let i = 0; i < body.occurrences; i++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const hours = clinicConfig.workingHours[dayOfWeek];

        if (!hours?.enabled) {
          skippedDates.push(dateStr);
          currentDate = addInterval(currentDate, body.pattern);
          continue;
        }

        rows.push({
          clinic_id: clinicConfig.clinicId,
          patient_id: patientId,
          doctor_id: body.doctorId,
          service_id: body.serviceId ?? null,
          appointment_date: dateStr,
          start_time: body.time,
          end_time: endTime,
          status: "scheduled",
          is_first_visit: seqIndex === 0 ? (body.isFirstVisit ?? false) : false,
          insurance_flag: body.hasInsurance ?? false,
          booking_source: "online",
          recurrence_group_id: groupId,
          notes: `Recurring: ${body.pattern} (${i + 1}/${body.occurrences})`,
          is_emergency: false,
        });
        seqIndex++;
        currentDate = addInterval(currentDate, body.pattern);
      }

      if (rows.length === 0) {
        return NextResponse.json({ error: "No appointments could be created", success: false }, { status: 400 });
      }

      // Single bulk insert instead of N sequential inserts
      const { data: appts, error: batchError } = await supabase
        .from("appointments")
        .insert(rows as never[])
        .select("id");

      if (batchError || !appts || appts.length === 0) {
        return NextResponse.json({ error: "Failed to create recurring appointments", success: false }, { status: 500 });
      }

      const appointmentIds = appts.map((a: { id: string }) => a.id);

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
