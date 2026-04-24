/**
 * Public REST API — Appointments
 *
 * GET  /api/v1/appointments — List appointments for a clinic
 * POST /api/v1/appointments — Create an appointment
 *
 * Authentication: Bearer token via API key stored in clinic settings.
 */

import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { getCorsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { logTenantContext } from "@/lib/tenant-context";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { v1AppointmentCreateSchema } from "@/lib/validations";

/** Handle CORS preflight requests. */
export function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request);
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return apiError("Unauthorized. Provide a valid API key as Bearer token.", 401, "UNAUTHORIZED", cors);
  }

  logTenantContext(auth.clinicId, "v1/appointments:GET");
  const supabase = await createTenantClient(auth.clinicId);
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
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    logger.warn("Operation failed", { context: "v1/appointments", error });
    return apiInternalError("Failed to fetch appointments");
  }

  return apiSuccess({ data, pagination: { total: count, limit, offset } }, 200, cors);
}

export const POST = withValidation(v1AppointmentCreateSchema, async (body, request: NextRequest) => {
  const cors = getCorsHeaders(request);
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return apiError("Unauthorized. Provide a valid API key as Bearer token.", 401, "UNAUTHORIZED", cors);
  }

    // Build slot_start / slot_end from appointment_date + start_time / end_time.
    // These are required NOT NULL columns in the appointments table.
    const slotStart = `${body.appointment_date}T${body.start_time}`;
    // Normalize to ISO 8601 with seconds so Date parsing is unambiguous across runtimes
    const slotStartNormalized = slotStart.length === 16 ? `${slotStart}:00` : slotStart;
    const slotEnd = body.end_time
      ? `${body.appointment_date}T${body.end_time}`
      : new Date(new Date(slotStartNormalized).getTime() + 30 * 60_000).toISOString(); // default 30 min

    logTenantContext(auth.clinicId, "v1/appointments:POST");
    const supabase = await createTenantClient(auth.clinicId);
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
      logger.warn("Operation failed", { context: "v1/appointments", error });
      return apiInternalError("Failed to create appointment");
    }

    return apiSuccess({ data }, 201, cors);
});
