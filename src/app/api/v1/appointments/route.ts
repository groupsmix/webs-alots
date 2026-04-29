/**
 * Public REST API — Appointments
 *
 * GET  /api/v1/appointments — List appointments for a clinic
 * POST /api/v1/appointments — Create an appointment
 *
 * Authentication: Bearer token via API key stored in clinic settings.
 *
 * S-24 — Pagination: this endpoint uses keyset (cursor) pagination over
 * `(appointment_date, start_time, id)` rather than offset pagination.
 * Clients pass the opaque `cursor` returned in `pagination.next_cursor`
 * back on the following request to fetch the next page. Offset
 * pagination is no longer supported and the `offset` query parameter is
 * ignored.
 */

import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withValidation } from "@/lib/api-validate";
import { getCorsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
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
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") || 50)), 100);

  // S-24: Keyset pagination over (appointment_date, start_time, id).
  // The cursor is opaque to clients; we encode the last row's sort key
  // and the next request narrows the result set to rows strictly "older"
  // than that key in the descending sort order.
  const cursorParam = url.searchParams.get("cursor");
  let cursor = null;
  if (cursorParam) {
    cursor = decodeCursor(cursorParam);
    if (!cursor) {
      return apiError("Invalid cursor", 400, "INVALID_CURSOR", cors);
    }
  }

  // Fetch limit+1 so we can tell whether another page exists without an
  // extra round-trip or a COUNT query.
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", auth.clinicId)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (date) {
    query = query.eq("appointment_date", date);
  }
  if (status) {
    query = query.eq("status", status);
  }

  if (cursor) {
    // Row-tuple comparison `(appointment_date, start_time, id) < (cd, ct, ci)`
    // expressed as the disjunction PostgREST supports via `.or()`.
    const { appointment_date: cd, start_time: ct, id: ci } = cursor;
    query = query.or(
      [
        `appointment_date.lt.${cd}`,
        `and(appointment_date.eq.${cd},start_time.lt.${ct})`,
        `and(appointment_date.eq.${cd},start_time.eq.${ct},id.lt.${ci})`,
      ].join(","),
    );
  }

  const { data, error } = await query;

  if (error) {
    logger.warn("Operation failed", { context: "v1/appointments", error });
    return apiInternalError("Failed to fetch appointments");
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  // Guard against the (schema-impossible but type-allowed) case of a
  // nullable sort key — the columns are ORDER BY targets and rows
  // missing them cannot meaningfully participate in a cursor.
  const nextCursor =
    hasMore &&
    lastRow &&
    lastRow.appointment_date &&
    lastRow.start_time &&
    lastRow.id
      ? encodeCursor({
          appointment_date: lastRow.appointment_date,
          start_time: lastRow.start_time,
          id: lastRow.id,
        })
      : null;

  return apiSuccess(
    {
      data: pageRows,
      pagination: { limit, next_cursor: nextCursor, has_more: hasMore },
    },
    200,
    cors,
  );
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
