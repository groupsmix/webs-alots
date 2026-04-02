/**
 * CRUD API for Menu Items (Restaurant Vertical)
 * GET  /api/menu-items — list items for a menu
 * POST /api/menu-items — create a menu item
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiSupabaseError, apiError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { menuItemCreateSchema, menuItemUpdateSchema } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── GET: List menu items ──

export const GET = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const menuId = request.nextUrl.searchParams.get("menu_id");

    let query = supabase
      .from("menu_items")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });

    if (menuId) {
      query = query.eq("menu_id", menuId);
    }

    const { data, error } = await query;
    if (error) return apiSupabaseError(error, "menu-items/list");
    return apiSuccess({ items: data });
  },
  ["super_admin", "clinic_admin", "receptionist"],
);

// ── POST: Create menu item ──

export const POST = withAuthValidation(
  menuItemCreateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { data: item, error } = await supabase
      .from("menu_items")
      .insert({ ...data, clinic_id: clinicId })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "menu-items/create");

    await logAuditEvent({
      supabase,
      action: "menu_item.created",
      type: "admin",
      clinicId,
      description: `Created menu item: ${data.name}`,
      metadata: { item_id: item.id },
    });

    return apiSuccess({ item }, 201);
  },
  ["super_admin", "clinic_admin"],
);

// ── PATCH: Update menu item ──

export const PATCH = withAuthValidation(
  menuItemUpdateSchema,
  async (data, _request: NextRequest, auth) => {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { id, ...updates } = data;

    const { data: item, error } = await supabase
      .from("menu_items")
      .update(updates)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "menu-items/update");

    await logAuditEvent({
      supabase,
      action: "menu_item.updated",
      type: "admin",
      clinicId,
      description: `Updated menu item: ${id}`,
      metadata: { item_id: id },
    });

    return apiSuccess({ item });
  },
  ["super_admin", "clinic_admin"],
);

// ── DELETE: Remove menu item ──

export const DELETE = withAuth(
  async (request: NextRequest, { supabase, profile }: AuthContext) => {
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiError("No clinic associated", 403, "NO_CLINIC");
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    if (!id) {
      return apiError("Missing item id", 400, "MISSING_ID");
    }

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);

    if (error) return apiSupabaseError(error, "menu-items/delete");

    await logAuditEvent({
      supabase,
      action: "menu_item.deleted",
      type: "admin",
      clinicId,
      description: `Deleted menu item: ${id}`,
      metadata: { item_id: id },
    });

    return apiSuccess({ deleted: true });
  },
  ["super_admin", "clinic_admin"],
);
