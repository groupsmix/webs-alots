/**
 * Menu Items API — CRUD for restaurant menu items.
 *
 * GET  /api/menus/items?menuId=...  — List items (optionally filtered by menu)
 * POST /api/menus/items             — Create a new menu item
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiSupabaseError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const createMenuItemSchema = z.object({
  menu_id: z.string().uuid(),
  category: z.string().min(1).max(100).optional().default("main"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().min(0),
  photo_url: z.string().url().optional(),
  is_available: z.boolean().optional().default(true),
  allergens: z.array(z.string()).optional(),
  is_halal: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

/**
 * GET /api/menus/items
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiSuccess([]);

  const menuId = request.nextUrl.searchParams.get("menuId");

  let query = auth.supabase
    .from("menu_items")
    .select("id, menu_id, clinic_id, category, name, description, price, photo_url, is_available, allergens, is_halal, sort_order, created_at, updated_at")
    .eq("clinic_id", clinicId)
    .order("sort_order", { ascending: true });

  if (menuId) {
    query = query.eq("menu_id", menuId);
  }

  const { data, error } = await query;
  if (error) return apiSupabaseError(error, "menu-items/list");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist"]);

/**
 * POST /api/menus/items
 */
export const POST = withAuthValidation(createMenuItemSchema, async (body, _request, auth) => {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiSupabaseError({ message: "No clinic context" }, "menu-items/create");
  }

  const { data, error } = await auth.supabase
    .from("menu_items")
    .insert({
      clinic_id: clinicId,
      menu_id: body.menu_id,
      category: body.category,
      name: body.name,
      description: body.description ?? null,
      price: body.price,
      photo_url: body.photo_url ?? null,
      is_available: body.is_available,
      allergens: body.allergens ?? [],
      is_halal: body.is_halal,
      sort_order: body.sort_order,
    })
    .select()
    .single();

  if (error) return apiSupabaseError(error, "menu-items/create");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "menu_item.created",
    type: "admin",
    clinicId,
    description: `Menu item "${body.name}" created in menu ${body.menu_id}`,
  });

  return apiSuccess(data, 201);
}, ["super_admin", "clinic_admin"]);
