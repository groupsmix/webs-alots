import { apiError, apiForbidden, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/types/database";
import { customFieldCreateSchema, customFieldUpdateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";
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
      return apiError("clinic_type_key query parameter is required");
    }

    let query = supabase
      .from("custom_field_definitions")
      .select("id, clinic_type_key, entity_type, field_key, field_type, label_fr, label_ar, description, placeholder, is_required, sort_order, options, validation, default_value, is_system, is_active")
      .eq("clinic_type_key", clinicTypeKey)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data, error } = await query;

    if (error) {
      return apiInternalError("Failed to fetch custom field definitions");
    }

    return apiSuccess({ definitions: data ?? [] });
  } catch (err) {
    logger.warn("Operation failed", { context: "custom-fields", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"]);

/**
 * POST /api/custom-fields
 *
 * Create a new custom field definition.
 * Only super admins can create definitions.
 */
export const POST = withAuthValidation(customFieldCreateSchema, async (body, request, { supabase }) => {
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
    } = body;

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
      return apiInternalError("Failed to create custom field definition");
    }

    return apiSuccess({ definition: data }, 201);
}, ["super_admin"]);

/**
 * PATCH /api/custom-fields
 *
 * Update an existing custom field definition.
 * Body must include `id` and any fields to update.
 */
export const PATCH = withAuthValidation(customFieldUpdateSchema, async (body, request, { supabase }) => {
    const { id, ...updates } = body;

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
      // @ts-expect-error -- Supabase generated types lag behind actual DB schema
      .update(allowedUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.warn("Operation failed", { context: "custom-fields", error });
      return apiInternalError("Failed to update custom field definition");
    }

    return apiSuccess({ definition: data });
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
    return apiError("id query parameter is required");
  }

  // Check if it's a system field
  const { data: existing } = await supabase
    .from("custom_field_definitions")
    .select("is_system")
    .eq("id", id)
    .single();

  if (existing?.is_system) {
    return apiForbidden("System fields cannot be deleted");
  }

  const { error } = await supabase
    .from("custom_field_definitions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logger.warn("Operation failed", { context: "custom-fields", error });
    return apiInternalError("Failed to delete custom field definition");
  }

  return apiSuccess({ success: true });
}, ["super_admin"]);
