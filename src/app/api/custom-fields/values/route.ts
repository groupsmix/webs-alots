import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";

export const runtime = "edge";

const STAFF_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];

/**
 * GET /api/custom-fields/values?clinic_id=...&entity_type=...&entity_id=...
 *
 * Returns custom field values for a specific entity instance.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
  }

  const clinicId = request.nextUrl.searchParams.get("clinic_id");
  const entityType = request.nextUrl.searchParams.get("entity_type");
  const entityId = request.nextUrl.searchParams.get("entity_id");

  if (!clinicId || !entityType || !entityId) {
    return NextResponse.json(
      { error: "clinic_id, entity_type, and entity_id are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("custom_field_values")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("entity_type", entityType as unknown as never)
    .eq("entity_id", entityId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    values: data?.field_values ?? {},
    id: data?.id ?? null,
  });
}

/**
 * POST /api/custom-fields/values
 *
 * Save (upsert) custom field values for a specific entity instance.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();
    if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { clinic_id, entity_type, entity_id, field_values } = body;

    if (!clinic_id || !entity_type || !entity_id || !field_values) {
      return NextResponse.json(
        { error: "clinic_id, entity_type, entity_id, and field_values are required" },
        { status: 400 },
      );
    }

    // Upsert: insert or update on conflict
    const { data, error } = await supabase
      .from("custom_field_values")
      .upsert(
        {
          clinic_id,
          entity_type,
          entity_id,
          field_values,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clinic_id,entity_type,entity_id",
        },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ values: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

/**
 * PATCH /api/custom-fields/values
 *
 * Partially update custom field values (merge with existing).
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();
    if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { clinic_id, entity_type, entity_id, field_values } = body;

    if (!clinic_id || !entity_type || !entity_id || !field_values) {
      return NextResponse.json(
        { error: "clinic_id, entity_type, entity_id, and field_values are required" },
        { status: 400 },
      );
    }

    // Get existing values
    const { data: existing } = await supabase
      .from("custom_field_values")
      .select("field_values")
      .eq("clinic_id", clinic_id)
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id)
      .single();

    const mergedValues = {
      ...(existing?.field_values as Record<string, unknown> ?? {}),
      ...field_values,
    };

    const { data, error } = await supabase
      .from("custom_field_values")
      .upsert(
        {
          clinic_id,
          entity_type,
          entity_id,
          field_values: mergedValues,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clinic_id,entity_type,entity_id",
        },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ values: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
