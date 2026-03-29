/**
 * Public REST API — Patients
 *
 * GET  /api/v1/patients — List patients for a clinic
 * POST /api/v1/patients — Create a patient
 *
 * Authentication: Bearer token via API key stored in clinic settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createTenantClient } from "@/lib/supabase-server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getCorsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import type { TablesInsert } from "@/lib/types/database";
import { v1PatientCreateSchema } from "@/lib/validations";
import { logTenantContext } from "@/lib/tenant-context";
import { withValidation } from "@/lib/api-validate";

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

  logTenantContext(auth.clinicId, "v1/patients:GET");
  const supabase = await createTenantClient(auth.clinicId);
  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
  const offset = Number(url.searchParams.get("offset") || 0);

  let query = supabase
    .from("users")
    .select("id, full_name, email, phone, created_at", { count: "exact" })
    .eq("clinic_id", auth.clinicId)
    .eq("role", "patient")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    // MED-05: Sanitize search input to prevent PostgREST filter injection.
    // Strip %, _, comma, parens AND dots (PostgREST uses . as filter separator).
    const sanitized = search.replace(/[%_,.()]/g, "");
    if (sanitized.length > 0) {
      query = query.or(`full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
    }
  }

  const { data, count, error } = await query;

  if (error) {
    logger.warn("Operation failed", { context: "v1/patients", error });
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500, headers: getCorsHeaders(request) });
  }

  return NextResponse.json({
    data,
    pagination: { total: count, limit, offset },
  }, { headers: getCorsHeaders(request) });
}

export const POST = withValidation(v1PatientCreateSchema, async (body, request: NextRequest) => {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key as Bearer token." },
      { status: 401, headers: getCorsHeaders(request) },
    );
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
      full_name: body.full_name,
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
      return NextResponse.json({ error: "Failed to create patient" }, { status: 500, headers: getCorsHeaders(request) });
    }

    return NextResponse.json({ data }, { status: 201, headers: getCorsHeaders(request) });
});
