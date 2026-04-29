/**
 * Public REST API — Patients
 *
 * GET  /api/v1/patients — List patients for a clinic
 * POST /api/v1/patients — Create a patient
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
import type { TablesInsert } from "@/lib/types/database";
import { v1PatientCreateSchema } from "@/lib/validations";

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

  logTenantContext(auth.clinicId, "v1/patients:GET");
  const supabase = await createTenantClient(auth.clinicId);
  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
  const offset = Number(url.searchParams.get("offset") || 0);

  let query = supabase
    .from("users")
    .select("id, name, name_ar, email, phone, created_at", { count: "exact" })
    .eq("clinic_id", auth.clinicId)
    .eq("role", "patient")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    // MED-05: Sanitize search input to prevent PostgREST filter injection.
    // Strip %, _, comma, parens AND dots (PostgREST uses . as filter separator).
    const sanitized = search.replace(/[%_,.()]/g, "");
    if (sanitized.length > 0) {
      // B-01: Use `name` (and `name_ar` for Arabic search) instead of the
      // non-existent `full_name` column which caused a 500 on every request.
      query = query.or(`name.ilike.%${sanitized}%,name_ar.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
    }
  }

  const { data, count, error } = await query;

  if (error) {
    logger.warn("Operation failed", { context: "v1/patients", error });
    return apiInternalError("Failed to fetch patients");
  }

  return apiSuccess({ data, pagination: { total: count, limit, offset } }, 200, cors);
}

export const POST = withValidation(v1PatientCreateSchema, async (body, request: NextRequest) => {
  const cors = getCorsHeaders(request);
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return apiError("Unauthorized. Provide a valid API key as Bearer token.", 401, "UNAUTHORIZED", cors);
  }

    logTenantContext(auth.clinicId, "v1/patients:POST");
    const supabase = await createTenantClient(auth.clinicId);
    // The users table has columns (full_name, date_of_birth, gender,
    // insurance_type, address) that are not yet in the generated
    // Supabase types.  Use a Record<string, unknown> insert so the
    // payload is still checked at the JS level without a blanket `any`.
    const insertPayload: Record<string, unknown> = {
      clinic_id: auth.clinicId,
      role: "patient",
      // B-01: Map the API field `full_name` to the DB column `name`.
      name: body.full_name,
      email: body.email || null,
      phone: body.phone || null,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      insurance_type: body.insurance_type || null,
      address: body.address || null,
    };
    const { data, error } = await supabase.from("users")
      .insert(insertPayload as TablesInsert<"users">)
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "v1/patients", error });
      return apiInternalError("Failed to create patient");
    }

    return apiSuccess({ data }, 201, cors);
});
