/**
 * Public REST API — Patients
 *
 * GET  /api/v1/patients — List patients for a clinic
 * POST /api/v1/patients — Create a patient
 *
 * Authentication: Bearer token via API key stored in clinic settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { authenticateApiKey } from "@/lib/api-auth";
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
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
  const offset = Number(url.searchParams.get("offset") || 0);

  let query = supabase
    .from("users")
    .select("id, full_name, email, phone, date_of_birth, gender, insurance_type, created_at", { count: "exact" })
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
    logger.warn("Operation failed", { context: "route", error });
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500, headers: getCorsHeaders(request) });
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

    const required = ["full_name"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    // Input length validation to prevent oversized payloads
    const lengthLimits: Record<string, number> = {
      full_name: 200,
      email: 254,
      phone: 30,
      address: 500,
      gender: 20,
      insurance_type: 100,
    };
    for (const [field, maxLen] of Object.entries(lengthLimits)) {
      if (typeof body[field] === "string" && body[field].length > maxLen) {
        return NextResponse.json(
          { error: `Field '${field}' exceeds maximum length of ${maxLen} characters` },
          { status: 400, headers: getCorsHeaders(request) },
        );
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase.from("users")
      .insert({
        clinic_id: auth.clinicId,
        role: "patient",
        full_name: body.full_name,
        email: body.email || null,
        phone: body.phone || null,
        date_of_birth: body.date_of_birth || null,
        gender: body.gender || null,
        insurance_type: body.insurance_type || null,
        address: body.address || null,
      } as never)
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "route", error });
      return NextResponse.json({ error: "Failed to create patient" }, { status: 500, headers: getCorsHeaders(request) });
    }

    return NextResponse.json({ data }, { status: 201, headers: getCorsHeaders(request) });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: getCorsHeaders(request) });
  }
}
