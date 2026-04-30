/**
 * Restaurant Orders API
 *
 * CRUD operations for restaurant orders.
 * Scoped to the authenticated user's clinic.
 *
 * GET    /api/restaurant-orders             — List orders (optionally filter by status/table)
 * POST   /api/restaurant-orders             — Create a new order
 * PATCH  /api/restaurant-orders             — Update an order (status, items, etc.)
 * DELETE /api/restaurant-orders?id=...      — Cancel an order
 */

import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/types/database";
import { restaurantOrderCreateSchema, restaurantOrderUpdateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/restaurant-orders
 *
 * List orders for the authenticated user's clinic.
 * Optionally filter by ?status=... or ?table_id=...
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  try {
    if (!profile.clinic_id) {
      return apiError("No clinic associated with this account", 403);
    }

    const status = request.nextUrl.searchParams.get("status");
    const tableId = request.nextUrl.searchParams.get("table_id");

    let query = supabase
      .from("restaurant_orders")
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (tableId) {
      query = query.eq("table_id", tableId);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn("Failed to fetch orders", { context: "restaurant-orders", error });
      return apiInternalError("Failed to fetch orders");
    }

    return apiSuccess({ orders: data ?? [] });
  } catch (err) {
    logger.warn("Operation failed", { context: "restaurant-orders", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin", "doctor", "receptionist"]);

/**
 * POST /api/restaurant-orders
 *
 * Create a new restaurant order.
 * Calculates subtotal, tax (20% TVA Morocco), and total from items.
 */
export const POST = withAuthValidation(restaurantOrderCreateSchema, async (body, _request, { supabase, profile }) => {
  if (!profile.clinic_id) {
    return apiError("No clinic associated with this account", 403);
  }

  // Calculate totals from items
  const subtotal = body.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const tax = Math.round(subtotal * 0.2 * 100) / 100; // 20% TVA
  const total = Math.round((subtotal + tax) * 100) / 100;

  const { data, error } = await supabase
    .from("restaurant_orders")
    .insert({
      clinic_id: profile.clinic_id,
      table_id: body.table_id ?? null,
      appointment_id: body.appointment_id ?? null,
      items: body.items as unknown as Json,
      subtotal,
      tax,
      total,
      status: "pending",
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.warn("Failed to create order", { context: "restaurant-orders", error });
    return apiInternalError("Failed to create order");
  }

  return apiSuccess({ order: data }, 201);
}, ["super_admin", "clinic_admin", "doctor", "receptionist"]);

/**
 * PATCH /api/restaurant-orders
 *
 * Update an order's status, items, or notes.
 */
export const PATCH = withAuthValidation(restaurantOrderUpdateSchema, async (body, _request, { supabase, profile }) => {
  if (!profile.clinic_id) {
    return apiError("No clinic associated with this account", 403);
  }
  const { id, ...updates } = body;

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) {
    updatePayload.status = updates.status;
  }
  if (updates.notes !== undefined) {
    updatePayload.notes = updates.notes;
  }
  if (updates.items !== undefined) {
    updatePayload.items = updates.items as unknown as Json;
    // Recalculate totals
    const subtotal = updates.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    updatePayload.subtotal = subtotal;
    updatePayload.tax = Math.round(subtotal * 0.2 * 100) / 100;
    updatePayload.total = Math.round((subtotal + subtotal * 0.2) * 100) / 100;
  }

  const { data, error } = await supabase
    .from("restaurant_orders")
    .update(updatePayload)
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .select()
    .single();

  if (error) {
    logger.warn("Failed to update order", { context: "restaurant-orders", error });
    return apiInternalError("Failed to update order");
  }

  return apiSuccess({ order: data });
}, ["super_admin", "clinic_admin", "doctor", "receptionist"]);

/**
 * DELETE /api/restaurant-orders?id=...
 *
 * Cancel an order (set status to 'cancelled').
 */
export const DELETE = withAuth(async (request, { supabase, profile }) => {
  if (!profile.clinic_id) {
    return apiError("No clinic associated with this account", 403);
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return apiError("id query parameter is required");
  }

  const { error } = await supabase
    .from("restaurant_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    logger.warn("Failed to cancel order", { context: "restaurant-orders", error });
    return apiInternalError("Failed to cancel order");
  }

  return apiSuccess({ cancelled: true });
}, ["super_admin", "clinic_admin"]);
