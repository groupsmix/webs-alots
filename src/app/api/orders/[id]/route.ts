/**
 * Order Detail API — Read, Update (status), Delete a single order.
 *
 * GET    /api/orders/[id]  — Get an order
 * PATCH  /api/orders/[id]  — Update order status
 * DELETE /api/orders/[id]  — Cancel/delete an order
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiNotFound, apiSupabaseError, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { safeParse } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const updateOrderSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready", "served", "completed", "cancelled"]).optional(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().min(0),
    notes: z.string().optional(),
  })).optional(),
});

/** Extract the order ID from the URL path: /api/orders/[id] */
function extractId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split("/");
  return segments[segments.length - 1];
}

/**
 * GET /api/orders/[id]
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { data, error } = await auth.supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (error || !data) return apiNotFound("Order not found");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * PATCH /api/orders/[id]
 */
export const PATCH = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 422);
  }

  const result = safeParse(updateOrderSchema, body);
  if (!result.success) return apiError(result.error, 422);

  const updateData: Record<string, unknown> = {};
  if (result.data.status) updateData.status = result.data.status;
  if (result.data.items) {
    updateData.items = result.data.items;
    const subtotal = result.data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    updateData.subtotal = subtotal;
    updateData.tax_amount = Math.round(subtotal * 0.20 * 100) / 100;
    updateData.total = subtotal + (updateData.tax_amount as number);
  }

  const { data, error } = await auth.supabase
    .from("orders")
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    .update(updateData)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .select()
    .single();

  if (error) return apiSupabaseError(error, "orders/update");
  if (!data) return apiNotFound("Order not found");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "order.updated",
    type: "payment",
    clinicId,
    description: `Order ${id} updated${result.data.status ? ` → ${result.data.status}` : ""}`,
  });

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * DELETE /api/orders/[id]
 */
export const DELETE = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { error } = await auth.supabase
    .from("orders")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return apiSupabaseError(error, "orders/delete");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "order.deleted",
    type: "admin",
    clinicId,
    description: `Order ${id} deleted`,
  });

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin"]);
