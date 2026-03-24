import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";
import { customFieldCreateSchema, customFieldUpdateSchema, safeParse } from "@/lib/validations";
import type { Json } from "@/lib/types/database";

export const runtime = "edge";

/**
 * GET /api/custom-fields?clinic_type_key=...&entity_type=...
 *
 * Returns custom field definitions for a given clinic type and entity.
 * Requires authentication to prevent unauthenticated enumeration.
 */
export const GET = withAuth(async (request, { supabase }) => {
  try {
    const clinicTypeKey = request.nextUrl.searchParams.get("clinic_type_key");
    const entityType = request.nextUrl.searchParams.get("entity_type");

    if (!clinicTypeKey) {
      return NextResponse.json(
        { error: "clinic_type_key query parameter is required" },
        { status: 400 },
      );
    }

    let query = supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("clinic_type_key", clinicTypeKey)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch custom field definitions" },
        { status: 500 },
      );
    }

    return NextResponse.json({ definitions: data ?? [] });
  } catch (err) {
    logger.warn("Operation failed", { context: "custom-fields", error: err });
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}, null);

/**
 * POST /api/custom-fields
 *
 * Create a new custom field definition.
 * Only super admins can create definitions.
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(customFieldCreateSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const {
      clinic_type_key,
      entity_type,
      field_key,
      field_type,
      label_fr,
      label_ar,
      description,
      placeholder,
      is_required,
      sort_order,
      options,
      validation,
      default_value,
    } = parsed.data;

    const { data, error } = await supabase
      .from("custom_field_definitions")
      .insert({
        clinic_type_key,
        entity_type,
        field_key,
        field_type,
        label_fr,
        label_ar,
        description,
        placeholder,
        is_required,
        sort_order,
        options: options as Json,
        validation: validation as Json,
        default_value: default_value as Json,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "custom-fields", error });
      return NextResponse.json(
        { error: "Failed to create custom field definition" },
        { status: 500 },
      );
    }

    return NextResponse.json({ definition: data }, { status: 201 });
  } catch (err) {
    logger.warn("Operation failed", { context: "custom-fields", error: err });
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}, ["super_admin"]);

/**
 * PATCH /api/custom-fields
 *
 * Update an existing custom field definition.
 * Body must include `id` and any fields to update.
 */
export const PATCH = withAuth(async (request, { supabase }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(customFieldUpdateSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { id, ...updates } = parsed.data;

    // Prevent modifying system field keys
    const allowedUpdates: Record<string, unknown> = {};
    const allowedKeys = [
      "label_fr", "label_ar", "description", "placeholder",
      "is_required", "sort_order", "options", "validation",
      "default_value", "is_active",
    ];
    for (const key of allowedKeys) {
      if (key in updates) {
        allowedUpdates[key] = (updates as Record<string, unknown>)[key];
      }
    }
    allowedUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("custom_field_definitions")
      .update(allowedUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "custom-fields", error });
      return NextResponse.json(
        { error: "Failed to update custom field definition" },
        { status: 500 },
      );
    }

    return NextResponse.json({ definition: data });
  } catch (err) {
    logger.warn("Operation failed", { context: "custom-fields", error: err });
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}, ["super_admin"]);

/**
 * DELETE /api/custom-fields?id=...
 *
 * Soft-delete a custom field definition (sets is_active = false).
 * System fields cannot be deleted.
 */
export const DELETE = withAuth(async (request, { supabase }) => {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "id query parameter is required" },
      { status: 400 },
    );
  }

  // Check if it's a system field
  const { data: existing } = await supabase
    .from("custom_field_definitions")
    .select("is_system")
    .eq("id", id)
    .single();

  if (existing?.is_system) {
    return NextResponse.json(
      { error: "System fields cannot be deleted" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("custom_field_definitions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logger.warn("Operation failed", { context: "custom-fields", error });
    return NextResponse.json(
      { error: "Failed to delete custom field definition" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}, ["super_admin"]);
