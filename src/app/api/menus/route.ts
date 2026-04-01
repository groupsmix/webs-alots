/**
 * Menu Management API (Restaurant Vertical)
 *
 * CRUD operations for menus and menu items.
 * Scoped to the authenticated user's clinic.
 *
 * GET    /api/menus?clinic_id=...            — List menus (public: by clinic_id, admin: own clinic)
 * GET    /api/menus?menu_id=...&items=true   — Get menu with items
 * POST   /api/menus                          — Create a menu or menu item
 * PATCH  /api/menus                          — Update a menu or menu item
 * DELETE /api/menus?id=...&type=menu|item    — Delete a menu or menu item
 */

import { apiError, apiSuccess, apiInternalError, apiNotFound } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import {
  menuCreateSchema,
  menuUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
} from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/**
 * GET /api/menus
 *
 * List menus for the authenticated user's clinic.
 * If menu_id is provided, returns the menu with its items.
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  try {
    const menuId = request.nextUrl.searchParams.get("menu_id");
    const includeItems = request.nextUrl.searchParams.get("items") === "true";

    // Single menu with items
    if (menuId) {
      const { data: menu, error: menuError } = await supabase
        .from("menus")
        .select("*")
        .eq("id", menuId)
        .eq("clinic_id", profile.clinic_id!)
        .single();

      if (menuError || !menu) {
        return apiNotFound("Menu not found");
      }

      if (includeItems) {
        const { data: items } = await supabase
          .from("menu_items")
          .select("*")
          .eq("menu_id", menuId)
          .eq("clinic_id", profile.clinic_id!)
          .order("sort_order", { ascending: true });

        return apiSuccess({ menu, items: items ?? [] });
      }

      return apiSuccess({ menu });
    }

    // List all menus
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .eq("clinic_id", profile.clinic_id!)
      .order("sort_order", { ascending: true });

    if (error) {
      logger.warn("Failed to fetch menus", { context: "menus", error });
      return apiInternalError("Failed to fetch menus");
    }

    return apiSuccess({ menus: data ?? [] });
  } catch (err) {
    logger.warn("Operation failed", { context: "menus", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin", "doctor", "receptionist", "patient"]);

/**
 * POST /api/menus
 *
 * Create a new menu. Use action=menu (default) or action=item.
 */
export const POST = withAuth(async (request, { supabase, profile }) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = (body.action as string) ?? "menu";

    if (action === "item") {
      const parsed = menuItemCreateSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return apiError(`Validation error: ${msg}`, 422, "VALIDATION_ERROR");
      }

      const { data, error } = await supabase
        .from("menu_items")
        .insert({
          ...parsed.data,
          clinic_id: profile.clinic_id!,
        })
        .select()
        .single();

      if (error) {
        logger.warn("Failed to create menu item", { context: "menus", error });
        return apiInternalError("Failed to create menu item");
      }

      return apiSuccess({ item: data }, 201);
    }

    // Default: create menu
    const parsed = menuCreateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return apiError(`Validation error: ${msg}`, 422, "VALIDATION_ERROR");
    }

    const { data, error } = await supabase
      .from("menus")
      .insert({
        ...parsed.data,
        clinic_id: profile.clinic_id!,
      })
      .select()
      .single();

    if (error) {
      logger.warn("Failed to create menu", { context: "menus", error });
      return apiInternalError("Failed to create menu");
    }

    return apiSuccess({ menu: data }, 201);
  } catch (err) {
    logger.warn("Operation failed", { context: "menus", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin"]);

/**
 * PATCH /api/menus
 *
 * Update a menu or menu item. Requires action=menu or action=item.
 */
export const PATCH = withAuth(async (request, { supabase, profile }) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = (body.action as string) ?? "menu";

    if (action === "item") {
      const parsed = menuItemUpdateSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return apiError(`Validation error: ${msg}`, 422, "VALIDATION_ERROR");
      }

      const { id, ...updates } = parsed.data;
      const { data, error } = await supabase
        .from("menu_items")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("clinic_id", profile.clinic_id!)
        .select()
        .single();

      if (error) {
        logger.warn("Failed to update menu item", { context: "menus", error });
        return apiInternalError("Failed to update menu item");
      }

      return apiSuccess({ item: data });
    }

    // Default: update menu
    const parsed = menuUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return apiError(`Validation error: ${msg}`, 422, "VALIDATION_ERROR");
    }

    const { id, ...updates } = parsed.data;
    const { data, error } = await supabase
      .from("menus")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("clinic_id", profile.clinic_id!)
      .select()
      .single();

    if (error) {
      logger.warn("Failed to update menu", { context: "menus", error });
      return apiInternalError("Failed to update menu");
    }

    return apiSuccess({ menu: data });
  } catch (err) {
    logger.warn("Operation failed", { context: "menus", error: err });
    return apiInternalError("Failed to process request");
  }
}, ["super_admin", "clinic_admin"]);

/**
 * DELETE /api/menus?id=...&type=menu|item
 *
 * Delete a menu or menu item.
 */
export const DELETE = withAuth(async (request, { supabase, profile }) => {
  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type") ?? "menu";

  if (!id) {
    return apiError("id query parameter is required");
  }

  const table = type === "item" ? "menu_items" : "menus";

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id!);

  if (error) {
    logger.warn(`Failed to delete ${type}`, { context: "menus", error });
    return apiInternalError(`Failed to delete ${type}`);
  }

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin"]);
