import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";
import { getPublicServices } from "@/lib/data/public";

export const runtime = "edge";

function addInterval(date: Date, pattern: "weekly" | "biweekly" | "monthly"): Date {
  const next = new Date(date);
  if (pattern === "weekly") next.setDate(next.getDate() + 7);
  else if (pattern === "biweekly") next.setDate(next.getDate() + 14);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * POST /api/booking/recurring
 *
 * Create a recurring booking series or cancel one.
 */
export async function POST(request: NextRequest) {
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

    const supabase = await createClient();

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
      let patientId = body.patientId;
      if (patientId.startsWith("patient-")) {
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("clinic_id", clinicConfig.clinicId)
          .eq("name", body.patientName)
          .eq("role", "patient")
          .limit(1)
          .single();

        if (existing) {
          patientId = existing.id;
        } else {
          const { data: newPatient } = await supabase
            .from("users")
            .insert({
              clinic_id: clinicConfig.clinicId,
              name: body.patientName,
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

      for (let i = 0; i < body.occurrences; i++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayOfWeek = currentDate.getDay();
        const hours = clinicConfig.workingHours[dayOfWeek];

        if (!hours?.enabled) {
          skippedDates.push(dateStr);
          currentDate = addInterval(currentDate, body.pattern);
          continue;
        }

        const { data: appt, error: apptError } = await supabase
          .from("appointments")
          .insert({
            clinic_id: clinicConfig.clinicId,
            patient_id: patientId,
            doctor_id: body.doctorId,
            service_id: body.serviceId ?? null,
            appointment_date: dateStr,
            start_time: body.time,
            end_time: endTime,
            status: "scheduled",
            is_first_visit: i === 0 ? (body.isFirstVisit ?? false) : false,
            insurance_flag: body.hasInsurance ?? false,
            booking_source: "online",
            notes: `Recurring: ${body.pattern} (${i + 1}/${body.occurrences}) group:${groupId}`,
            is_emergency: false,
          })
          .select("id")
          .single();

        if (!apptError && appt) {
          appointmentIds.push(appt.id);
        } else {
          skippedDates.push(dateStr);
        }

        currentDate = addInterval(currentDate, body.pattern);
      }

      if (appointmentIds.length === 0) {
        return NextResponse.json({ error: "No appointments could be created", success: false }, { status: 400 });
      }

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

      // Find appointments in the group by searching notes
      const { data: groupAppts } = await supabase
        .from("appointments")
        .select("id, status, notes")
        .eq("clinic_id", clinicConfig.clinicId)
        .like("notes", `%group:${body.groupId}%`);

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
}
