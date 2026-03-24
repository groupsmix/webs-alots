import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { customFieldValuesSchema, safeParse } from "@/lib/validations";
import type { Json } from "@/lib/types/database";

export const runtime = "edge";

/**
 * GET /api/custom-fields/values?entity_type=...&entity_id=...
 *
 * Returns custom field values for a specific entity instance.
 * clinic_id is derived from the authenticated user's profile.
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  const clinicId = profile.clinic_id;
  const entityType = request.nextUrl.searchParams.get("entity_type");
  const entityId = request.nextUrl.searchParams.get("entity_id");

  if (!clinicId || !entityType || !entityId) {
    return NextResponse.json(
      { error: "entity_type and entity_id are required, and user must belong to a clinic" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("custom_field_values")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .single();

  if (error && error.code !== "PGRST116") {
    logger.warn("Operation failed", { context: "custom-fields/values", error });
    return NextResponse.json(
      { error: "Failed to fetch custom field values" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    values: data?.field_values ?? {},
    id: data?.id ?? null,
  });
}, STAFF_ROLES);

/**
 * POST /api/custom-fields/values
 *
 * Save (upsert) custom field values for a specific entity instance.
 */
export const POST = withAuth(async (request, { supabase, profile }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(customFieldValuesSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { entity_type, entity_id, field_values } = parsed.data;
    // Always derive clinic_id from the authenticated user's profile
    const clinic_id = profile.clinic_id;
    if (!clinic_id) {
      return NextResponse.json(
        { error: "User must belong to a clinic" },
        { status: 400 },
      );
    }

    const { data: definitions } = await supabase
      .from("custom_field_definitions")
      .select("field_key, field_type")
      .eq("clinic_id", clinic_id)
      .eq("entity_type", entity_type);

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
          field_values: field_values as Json,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clinic_id,entity_type,entity_id",
        },
      )
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "custom-fields/values", error });
      return NextResponse.json(
        { error: "Failed to save custom field values" },
        { status: 500 },
      );
    }

    return NextResponse.json({ values: data });
  } catch (err) {
    logger.warn("Operation failed", { context: "custom-fields/values", error: err });
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}, STAFF_ROLES);

/**
 * PATCH /api/custom-fields/values
 *
 * Partially update custom field values (merge with existing).
 */
export const PATCH = withAuth(async (request, { supabase, profile }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(customFieldValuesSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { entity_type, entity_id, field_values } = parsed.data;
    // Always derive clinic_id from the authenticated user's profile
    const clinic_id = profile.clinic_id;
    if (!clinic_id) {
      return NextResponse.json(
        { error: "User must belong to a clinic" },
        { status: 400 },
      );
    }

    const { data: definitions } = await supabase
      .from("custom_field_definitions")
      .select("field_key, field_type")
      .eq("clinic_id", clinic_id)
      .eq("entity_type", entity_type);

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
          field_values: mergedValues as Json,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clinic_id,entity_type,entity_id",
        },
      )
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "custom-fields/values", error });
      return NextResponse.json(
        { error: "Failed to update custom field values" },
        { status: 500 },
      );
    }

    return NextResponse.json({ values: data });
  } catch (err) {
    logger.warn("Operation failed", { context: "custom-fields/values", error: err });
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}, STAFF_ROLES);
