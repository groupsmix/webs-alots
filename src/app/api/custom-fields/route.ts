import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";

export const runtime = "edge";

/**
 * GET /api/custom-fields?clinic_type_key=...&entity_type=...
 *
 * Returns custom field definitions for a given clinic type and entity.
 */
export async function GET(request: NextRequest) {
  try {
    const clinicTypeKey = request.nextUrl.searchParams.get("clinic_type_key");
    const entityType = request.nextUrl.searchParams.get("entity_type");

    if (!clinicTypeKey) {
      return NextResponse.json(
        { error: "clinic_type_key query parameter is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("clinic_type_key", clinicTypeKey)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (entityType) {
      query = query.eq("entity_type", entityType as unknown as never);
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
    logger.warn("Operation failed", { context: "route", error: err });
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/custom-fields
 *
 * Create a new custom field definition.
 * Only super admins can create definitions.
 */
export const POST = withAuth(async (request, { supabase }) => {
  try {
    const body = await request.json();

    const {
      clinic_type_key,
      entity_type,
      field_key,
      field_type,
      label_fr,
      label_ar = "",
      description = null,
      placeholder = null,
      is_required = false,
      sort_order = 0,
      options = [],
      validation = {},
      default_value = null,
    } = body;

    if (!clinic_type_key || !entity_type || !field_key || !field_type || !label_fr) {
      return NextResponse.json(
        { error: "clinic_type_key, entity_type, field_key, field_type, and label_fr are required" },
        { status: 400 },
      );
    }

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
        options,
        validation,
        default_value,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "route", error });
      return NextResponse.json(
        { error: "Failed to create custom field definition" },
        { status: 500 },
      );
    }

    return NextResponse.json({ definition: data }, { status: 201 });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
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
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 },
      );
    }

    // Prevent modifying system field keys
    const allowedUpdates: Record<string, unknown> = {};
    const allowedKeys = [
      "label_fr", "label_ar", "description", "placeholder",
      "is_required", "sort_order", "options", "validation",
      "default_value", "is_active",
    ];
    for (const key of allowedKeys) {
      if (key in updates) {
        allowedUpdates[key] = updates[key];
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
      logger.warn("Operation failed", { context: "route", error });
      return NextResponse.json(
        { error: "Failed to update custom field definition" },
        { status: 500 },
      );
    }

    return NextResponse.json({ definition: data });
  } catch (err) {
    logger.warn("Operation failed", { context: "route", error: err });
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
    logger.warn("Operation failed", { context: "route", error });
    return NextResponse.json(
      { error: "Failed to delete custom field definition" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}, ["super_admin"]);
