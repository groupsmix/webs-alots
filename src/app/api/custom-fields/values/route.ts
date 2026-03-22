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

    // Validate field_values keys against defined custom field definitions
    if (typeof field_values !== "object" || field_values === null || Array.isArray(field_values)) {
      return NextResponse.json(
        { error: "field_values must be a plain object" },
        { status: 400 },
      );
    }

    const { data: definitions } = await supabase
      .from("custom_field_definitions")
      .select("field_key, field_type")
      .eq("clinic_id", clinic_id)
      .eq("entity_type", entity_type as unknown as never);

    if (definitions && definitions.length > 0) {
      const defMap = new Map(
        (definitions as { field_key: string; field_type: string }[]).map((d) => [d.field_key, d.field_type]),
      );
      const unknownKeys = Object.keys(field_values).filter((k) => !defMap.has(k));
      if (unknownKeys.length > 0) {
        return NextResponse.json(
          { error: `Unknown custom field keys: ${unknownKeys.join(", ")}` },
          { status: 400 },
        );
      }

      // Type-check values against declared field types
      for (const [key, value] of Object.entries(field_values as Record<string, unknown>)) {
        const expectedType = defMap.get(key);
        if (!expectedType) continue;
        const valid =
          (expectedType === "text" && typeof value === "string") ||
          (expectedType === "number" && typeof value === "number" && Number.isFinite(value)) ||
          (expectedType === "boolean" && typeof value === "boolean") ||
          (expectedType === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) ||
          (expectedType === "select" && typeof value === "string") ||
          (expectedType === "multiselect" && Array.isArray(value));
        if (!valid) {
          return NextResponse.json(
            { error: `Field "${key}" expects type "${expectedType}"` },
            { status: 400 },
          );
        }
      }
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

    // Validate field_values keys against defined custom field definitions
    if (typeof field_values !== "object" || field_values === null || Array.isArray(field_values)) {
      return NextResponse.json(
        { error: "field_values must be a plain object" },
        { status: 400 },
      );
    }

    const { data: definitions } = await supabase
      .from("custom_field_definitions")
      .select("field_key, field_type")
      .eq("clinic_id", clinic_id)
      .eq("entity_type", entity_type as unknown as never);

    if (definitions && definitions.length > 0) {
      const defMap = new Map(
        (definitions as { field_key: string; field_type: string }[]).map((d) => [d.field_key, d.field_type]),
      );
      const unknownKeys = Object.keys(field_values).filter((k) => !defMap.has(k));
      if (unknownKeys.length > 0) {
        return NextResponse.json(
          { error: `Unknown custom field keys: ${unknownKeys.join(", ")}` },
          { status: 400 },
        );
      }

      for (const [key, value] of Object.entries(field_values as Record<string, unknown>)) {
        const expectedType = defMap.get(key);
        if (!expectedType) continue;
        const valid =
          (expectedType === "text" && typeof value === "string") ||
          (expectedType === "number" && typeof value === "number" && Number.isFinite(value)) ||
          (expectedType === "boolean" && typeof value === "boolean") ||
          (expectedType === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) ||
          (expectedType === "select" && typeof value === "string") ||
          (expectedType === "multiselect" && Array.isArray(value));
        if (!valid) {
          return NextResponse.json(
            { error: `Field "${key}" expects type "${expectedType}"` },
            { status: 400 },
          );
        }
      }
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
