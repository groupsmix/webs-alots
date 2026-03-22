import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

export const runtime = "edge";

/**
 * POST /api/booking/emergency-slot
 *
 * Create an emergency slot (doctor only) or book an existing one.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "create" | "book";
      // Create fields
      doctorId?: string;
      date?: string;
      startTime?: string;
      durationMin?: number;
      reason?: string;
      // Book fields
      slotId?: string;
      patientId?: string;
      patientName?: string;
      serviceId?: string;
    };

    const supabase = await createClient();

    if (body.action === "create") {
      if (!body.doctorId || !body.date || !body.startTime || !body.durationMin) {
        return NextResponse.json(
          { error: "doctorId, date, startTime, and durationMin are required" },
          { status: 400 },
        );
      }

      // Verify doctor exists
      const { data: doctor } = await supabase
        .from("users")
        .select("id")
        .eq("id", body.doctorId)
        .eq("clinic_id", clinicConfig.clinicId)
        .eq("role", "doctor")
        .single();

      if (!doctor) {
        return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
      }

      // Calculate end time
      const [hh, mm] = body.startTime.split(":").map(Number);
      const endMinutes = hh * 60 + mm + body.durationMin;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const { data: slot, error: insertError } = await supabase
        .from("emergency_slots")
        .insert({
          clinic_id: clinicConfig.clinicId,
          doctor_id: body.doctorId,
          slot_date: body.date,
          start_time: body.startTime,
          end_time: endTime,
          reason: body.reason ?? null,
          is_booked: false,
        })
        .select("id")
        .single();

      if (insertError || !slot) {
        return NextResponse.json({ error: insertError?.message ?? "Failed to create emergency slot" }, { status: 500 });
      }

      return NextResponse.json({
        status: "created",
        message: "Emergency slot created",
        slotId: slot.id,
      });
    }

    if (body.action === "book") {
      if (!body.slotId || !body.patientId || !body.patientName) {
        return NextResponse.json(
          { error: "slotId, patientId, and patientName are required" },
          { status: 400 },
        );
      }

      // Fetch the emergency slot
      const { data: slot, error: slotError } = await supabase
        .from("emergency_slots")
        .select("id, doctor_id, slot_date, start_time, end_time, is_booked")
        .eq("id", body.slotId)
        .eq("clinic_id", clinicConfig.clinicId)
        .single();

      if (slotError || !slot) {
        return NextResponse.json({ error: "Emergency slot not found" }, { status: 404 });
      }

      if (slot.is_booked) {
        return NextResponse.json({ error: "Emergency slot is already booked" }, { status: 400 });
      }

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

      // Create appointment from emergency slot
      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          clinic_id: clinicConfig.clinicId,
          patient_id: patientId,
          doctor_id: slot.doctor_id,
          service_id: body.serviceId ?? null,
          appointment_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: "confirmed",
          is_first_visit: false,
          insurance_flag: false,
          booking_source: "online",
          is_emergency: true,
        } as never)
        .select("id")
        .single();

      if (apptError || !appointment) {
        return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
      }

      // Mark slot as booked
      await supabase
        .from("emergency_slots")
        .update({ is_booked: true })
        .eq("id", body.slotId);

      return NextResponse.json({
        status: "booked",
        message: "Emergency slot booked",
        appointmentId: appointment.id,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'book'" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process emergency slot request" }, { status: 500 });
  }
}

/**
 * GET /api/booking/emergency-slot?doctorId=...&date=...
 *
 * Get available emergency slots.
 */
export async function GET(request: NextRequest) {
  const doctorId = request.nextUrl.searchParams.get("doctorId") ?? undefined;
  const date = request.nextUrl.searchParams.get("date") ?? undefined;

  const supabase = await createClient();

  let q = supabase
    .from("emergency_slots")
    .select("id, doctor_id, slot_date, start_time, end_time, reason, is_booked, created_at")
    .eq("clinic_id", clinicConfig.clinicId);

  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }
  if (date) {
    q = q.eq("slot_date", date);
  }

  const { data: slots, error } = await q.order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ slots: [] });
  }

  return NextResponse.json({
    slots: (slots ?? []).map((s) => ({
      id: s.id,
      doctorId: s.doctor_id,
      date: s.slot_date,
      startTime: s.start_time,
      endTime: s.end_time,
      reason: s.reason,
      isBooked: s.is_booked,
      createdAt: s.created_at,
    })),
  });
}
