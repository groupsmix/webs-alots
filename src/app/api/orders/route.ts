/**
 * Orders API — CRUD for restaurant orders.
 *
 * GET  /api/orders  — List orders for the current restaurant
 * POST /api/orders  — Create a new order
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiSupabaseError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const orderItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().min(0),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  reservation_id: z.string().uuid().optional(),
  table_id: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1),
  order_source: z.enum(["in_person", "qr_code", "whatsapp", "phone"]).optional().default("in_person"),
});

/**
 * GET /api/orders
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiSuccess([]);

  const status = request.nextUrl.searchParams.get("status");

  let query = auth.supabase
    .from("orders")
    .select("id, clinic_id, reservation_id, table_id, items, subtotal, tax_amount, total, status, order_source, created_at, updated_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return apiSupabaseError(error, "orders/list");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * POST /api/orders
 */
export const POST = withAuthValidation(createOrderSchema, async (body, _request, auth) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiSupabaseError({ message: "No clinic context" }, "orders/create");
  }

  const subtotal = body.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Math.round(subtotal * 0.20 * 100) / 100; // 20% TVA standard Morocco
  const total = subtotal + taxAmount;

  const { data, error } = await auth.supabase
    .from("orders")
    .insert({
      clinic_id: clinicId,
      reservation_id: body.reservation_id ?? null,
      table_id: body.table_id ?? null,
      items: body.items,
      subtotal,
      tax_amount: taxAmount,
      total,
      status: "pending",
      order_source: body.order_source,
    })
    .select()
    .single();

  if (error) return apiSupabaseError(error, "orders/create");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "order.created",
    type: "payment",
    clinicId,
    description: `Order created: ${body.items.length} items, total ${total} MAD`,
  });

  return apiSuccess(data, 201);
}, ["super_admin", "clinic_admin", "receptionist"]);
