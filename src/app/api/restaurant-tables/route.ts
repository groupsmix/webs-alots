/**
 * Restaurant Table Management API
 *
 * CRUD operations for restaurant tables (seating).
 * Scoped to the authenticated user's clinic.
 *
 * GET    /api/restaurant-tables             — List all tables
 * POST   /api/restaurant-tables             — Create a new table
 * PATCH  /api/restaurant-tables             — Update a table
 * DELETE /api/restaurant-tables?id=...      — Delete a table
 */

import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { restaurantTableCreateSchema, restaurantTableUpdateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/restaurant-tables
 *
 * List all tables for the authenticated user's clinic.
 * Optionally filter by zone with ?zone=...
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  try {
    const zone = request.nextUrl.searchParams.get("zone");

    let query = supabase
      .from("restaurant_tables")
      .select("*")
      .eq("clinic_id", profile.clinic_id!)
      .order("name", { ascending: true });

    if (zone) {
      query = query.eq("zone", zone);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn("Failed to fetch tables", { context: "restaurant-tables", error });
      return apiInternalError("Failed to fetch tables");
    }

    return apiSuccess({ tables: data ?? [] });
  } catch (err) {
    logger.warn("Operation failed", { context: "restaurant-tables", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin", "doctor", "receptionist"]);

/**
 * POST /api/restaurant-tables
 *
 * Create a new restaurant table.
 */
export const POST = withAuthValidation(restaurantTableCreateSchema, async (body, _request, { supabase, profile }) => {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({
      ...body,
      clinic_id: profile.clinic_id!,
    })
    .select()
    .single();

  if (error) {
    logger.warn("Failed to create table", { context: "restaurant-tables", error });
    return apiInternalError("Failed to create table");
  }

  return apiSuccess({ table: data }, 201);
}, ["super_admin", "clinic_admin"]);

/**
 * PATCH /api/restaurant-tables
 *
 * Update a restaurant table.
 */
export const PATCH = withAuthValidation(restaurantTableUpdateSchema, async (body, _request, { supabase, profile }) => {
  const { id, ...updates } = body;

  const { data, error } = await supabase
    .from("restaurant_tables")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id!)
    .select()
    .single();

  if (error) {
    logger.warn("Failed to update table", { context: "restaurant-tables", error });
    return apiInternalError("Failed to update table");
  }

  return apiSuccess({ table: data });
}, ["super_admin", "clinic_admin"]);

/**
 * DELETE /api/restaurant-tables?id=...
 *
 * Delete a restaurant table.
 */
export const DELETE = withAuth(async (request, { supabase, profile }) => {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return apiError("id query parameter is required");
  }

  const { error } = await supabase
    .from("restaurant_tables")
    .delete()
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id!);

  if (error) {
    logger.warn("Failed to delete table", { context: "restaurant-tables", error });
    return apiInternalError("Failed to delete table");
  }

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin"]);
