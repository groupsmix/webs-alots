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
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { getCorsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";

/** Handle CORS preflight requests. */
export function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key as Bearer token." },
      { status: 401, headers: getCorsHeaders(request) },
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
    logger.warn("Operation failed", { context: "route", error });
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500, headers: getCorsHeaders(request) });
  }

  return NextResponse.json({
    data,
    pagination: { total: count, limit, offset },
  }, { headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key as Bearer token." },
      { status: 401, headers: getCorsHeaders(request) },
    );
  }

  try {
    const body = await request.json();

    const required = ["patient_id", "doctor_id", "appointment_date", "start_time"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    // Input length validation to prevent oversized payloads
    const lengthLimits: Record<string, number> = {
      patient_id: 100,
      doctor_id: 100,
      appointment_date: 10,
      start_time: 8,
      end_time: 8,
      status: 20,
      notes: 2000,
    };
    for (const [field, maxLen] of Object.entries(lengthLimits)) {
      if (typeof body[field] === "string" && body[field].length > maxLen) {
        return NextResponse.json(
          { error: `Field '${field}' exceeds maximum length of ${maxLen} characters` },
          { status: 400, headers: getCorsHeaders(request) },
        );
      }
    }

    // Build slot_start / slot_end from appointment_date + start_time / end_time.
    // These are required NOT NULL columns in the appointments table.
    const slotStart = `${body.appointment_date}T${body.start_time}`;
    const slotEnd = body.end_time
      ? `${body.appointment_date}T${body.end_time}`
      : new Date(new Date(slotStart).getTime() + 30 * 60_000).toISOString(); // default 30 min

    const supabase = await createClient();
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
        status: body.status || APPOINTMENT_STATUS.SCHEDULED,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "route", error });
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500, headers: getCorsHeaders(request) });
    }

    return NextResponse.json({ data }, { status: 201, headers: getCorsHeaders(request) });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: getCorsHeaders(request) });
  }
}
