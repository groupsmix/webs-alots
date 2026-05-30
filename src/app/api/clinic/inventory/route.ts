import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/clinic/inventory
 *
 * Lists all inventory items for the clinic, with optional filters.
 * Query params: ?category=medications&low_stock=true&search=gants
 */
async function handleGet(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic associated with this account", 403);
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const lowStock = url.searchParams.get("low_stock") === "true";
  const search = url.searchParams.get("search");

  try {
    const sb = auth.supabase as unknown as SupabaseUntyped;
    let query = sb
      .from("inventory_items")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("name", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Inventory fetch failed", {
        context: "inventory",
        error: error.message,
        clinicId,
      });
      return apiError("Failed to fetch inventory", 500);
    }

    let items = data ?? [];

    if (lowStock) {
      items = items.filter(
        (item: { quantity: number; min_stock: number }) => item.quantity <= item.min_stock,
      );
    }

    const lowStockCount = (data ?? []).filter(
      (item: { quantity: number; min_stock: number }) => item.quantity <= item.min_stock,
    ).length;

    return apiSuccess({ items, totalCount: (data ?? []).length, lowStockCount });
  } catch (err) {
    logger.error("Inventory fetch error", {
      context: "inventory",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Internal error", 500);
  }
}

/**
 * POST /api/clinic/inventory
 *
 * Adds a new inventory item to the clinic.
 */
async function handlePost(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic associated with this account", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const name = body.name as string | undefined;
  const category = body.category as string | undefined;
  const quantity = body.quantity as number | undefined;
  const unit = body.unit as string | undefined;
  const minStock = body.minStock as number | undefined;
  const unitPrice = body.unitPrice as number | undefined;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return apiValidationError("name is required");
  }
  if (!category || typeof category !== "string") {
    return apiValidationError("category is required");
  }
  if (typeof quantity !== "number" || quantity < 0) {
    return apiValidationError("quantity must be a non-negative number");
  }
  if (!unit || typeof unit !== "string") {
    return apiValidationError("unit is required (e.g., 'boîte', 'pièce', 'ml')");
  }
  if (typeof minStock !== "number" || minStock < 0) {
    return apiValidationError("minStock must be a non-negative number");
  }
  if (typeof unitPrice !== "number" || unitPrice < 0) {
    return apiValidationError("unitPrice must be a non-negative number (in MAD)");
  }

  const validCategories = [
    "medications",
    "consumables",
    "equipment",
    "lab_supplies",
    "office_supplies",
    "other",
  ];
  if (!validCategories.includes(category)) {
    return apiValidationError(`category must be one of: ${validCategories.join(", ")}`);
  }

  try {
    const sb = auth.supabase as unknown as SupabaseUntyped;
    const { data, error } = await sb
      .from("inventory_items")
      .insert({
        clinic_id: clinicId,
        name: name.trim(),
        category,
        quantity,
        unit: unit.trim(),
        min_stock: minStock,
        unit_price: unitPrice,
        supplier: typeof body.supplier === "string" ? body.supplier.trim() : null,
        expiry_date: typeof body.expiryDate === "string" ? body.expiryDate : null,
        notes: typeof body.notes === "string" ? body.notes.trim() : null,
        created_by: auth.profile.id,
      })
      .select()
      .single();

    if (error) {
      logger.error("Inventory insert failed", {
        context: "inventory",
        error: error.message,
        clinicId,
      });
      return apiError("Failed to add inventory item", 500);
    }

    return apiSuccess({ item: data });
  } catch (err) {
    logger.error("Inventory insert error", {
      context: "inventory",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Internal error", 500);
  }
}

export const GET = withAuth(handleGet, ["doctor", "clinic_admin"]);
export const POST = withAuth(handlePost, ["clinic_admin"]);
