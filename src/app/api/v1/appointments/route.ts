/**
 * Public REST API — Appointments
 *
 * GET  /api/v1/appointments — List appointments for a clinic
 * POST /api/v1/appointments — Create an appointment
 *
 * Authentication: Bearer token via API key stored in clinic settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { authenticateApiKey } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key as Bearer token." },
      { status: 401 },
    );
  }

  const supabase = await createClient();
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
  const offset = Number(url.searchParams.get("offset") || 0);

  let query = supabase
    .from("appointments")
    .select("*", { count: "exact" })
    .eq("clinic_id", auth.clinicId)
    .order("appointment_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (date) {
    query = query.eq("appointment_date", date);
  }
  if (status) {
    query = query.eq("status", status as unknown as never);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[GET /api/v1/appointments] Query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }

  return NextResponse.json({
    data,
    pagination: { total: count, limit, offset },
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key as Bearer token." },
      { status: 401 },
    );
  }

  const body = await request.json();

  const required = ["patient_id", "doctor_id", "appointment_date", "start_time"];
  const missing = required.filter((f) => !body[f]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  // Build slot_start / slot_end from appointment_date + start_time / end_time.
  // These are required NOT NULL columns in the appointments table.
  const slotStart = `${body.appointment_date}T${body.start_time}`;
  const slotEnd = body.end_time
    ? `${body.appointment_date}T${body.end_time}`
    : new Date(new Date(slotStart).getTime() + 30 * 60_000).toISOString(); // default 30 min

  const supabase = await createClient();

  // Check for overlapping appointments for the same doctor to prevent double-booking.
  // An overlap exists when an existing appointment's slot intersects with the new one:
  //   existing.slot_start < new.slot_end AND existing.slot_end > new.slot_start
  const { data: overlapping } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", auth.clinicId)
    .eq("doctor_id", body.doctor_id)
    .lt("slot_start", slotEnd)
    .gt("slot_end", slotStart)
    .not("status", "in", '("cancelled")')
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return NextResponse.json(
      { error: "Time slot conflicts with an existing appointment for this doctor" },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: auth.clinicId,
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      appointment_date: body.appointment_date,
      start_time: body.start_time,
      end_time: body.end_time || null,
      slot_start: slotStart,
      slot_end: slotEnd,
      status: body.status || "scheduled",
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/v1/appointments] Insert error:", error.message);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
