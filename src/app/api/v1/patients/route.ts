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

async function authenticateApiKey(
  request: NextRequest,
): Promise<{ clinicId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_api_keys")
    .select("clinic_id, active")
    .eq("key", apiKey)
    .single();

  if (!data?.active) return null;

  await supabase
    .from("clinic_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key", apiKey);

  return { clinicId: data.clinic_id };
}

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
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const required = ["full_name"];
  const missing = required.filter((f) => !body[f]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
