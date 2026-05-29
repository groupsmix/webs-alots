import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { inventoryItemCreateSchema, inventoryItemUpdateSchema } from "@/lib/validations/batch4c";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/inventory
 *
 * Create a new inventory item (equipment/consumable).
 */
export const POST = withAuthValidation(
  inventoryItemCreateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const {
      name,
      category,
      sku,
      description,
      unit,
      currentStock,
      minimumStock,
      maximumStock,
      reorderPoint,
      reorderQuantity,
      unitCostCentimes,
      supplierName,
      supplierPhone,
      supplierEmail,
      expiryDate,
      expiryAlertDays,
      location,
    } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      const { data: item, error: insertError } = await untypedSupabase
        .from("inventory_items")
        .insert({
          clinic_id: clinicId,
          name,
          category,
          sku: sku ?? null,
          description: description ?? null,
          unit: unit ?? "piece",
          current_stock: currentStock ?? 0,
          minimum_stock: minimumStock ?? 0,
          maximum_stock: maximumStock ?? null,
          reorder_point: reorderPoint ?? 5,
          reorder_quantity: reorderQuantity ?? 10,
          unit_cost_centimes: unitCostCentimes ?? null,
          supplier_name: supplierName ?? null,
          supplier_phone: supplierPhone ?? null,
          supplier_email: supplierEmail ?? null,
          expiry_date: expiryDate ?? null,
          expiry_alert_days: expiryAlertDays ?? 30,
          location: location ?? null,
          is_active: true,
        })
        .select("id, name, category, sku, current_stock, reorder_point, expiry_date")
        .single();

      if (insertError) {
        logger.error("Failed to create inventory item", {
          context: "api/inventory",
          error: insertError,
        });
        return apiInternalError("Échec de la création de l'article d'inventaire");
      }

      await logAuditEvent({
        supabase,
        action: "inventory_item_created",
        type: "admin",
        clinicId,
        actor: auth.user.id,
        description: `Inventory item created: ${name} (${category})`,
        metadata: { itemId: (item as { id: string }).id, name, category },
      });

      return apiSuccess({ item }, 201);
    } catch (err) {
      logger.error("Inventory creation failed", {
        context: "api/inventory",
        error: err,
      });
      return apiInternalError("Échec de la création de l'article d'inventaire");
    }
  },
  ["clinic_admin", "receptionist"],
);

/**
 * GET /api/inventory?category=...&lowStock=true&expiring=true
 *
 * List inventory items with optional filters.
 */
export const GET = withAuth(
  async (request: NextRequest, _auth: AuthContext) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      const url = request.nextUrl;
      const category = url.searchParams.get("category");
      const lowStock = url.searchParams.get("lowStock") === "true";
      const expiring = url.searchParams.get("expiring") === "true";

      let query = untypedSupabase
        .from("inventory_items")
        .select(
          "id, name, category, sku, description, unit, current_stock, minimum_stock, maximum_stock, reorder_point, reorder_quantity, unit_cost_centimes, supplier_name, supplier_phone, expiry_date, expiry_alert_days, location, is_active, last_restocked_at, created_at",
        )
        .eq("clinic_id", clinicId)
        .eq("is_active", true);

      if (category) query = query.eq("category", category);
      if (lowStock) query = query.lte("current_stock", query);

      const { data: items, error } = await query.order("name", { ascending: true });

      if (error) {
        logger.error("Failed to list inventory items", {
          context: "api/inventory",
          error,
        });
        return apiInternalError("Échec de la récupération de l'inventaire");
      }

      type ItemRow = {
        id: string;
        name: string;
        category: string;
        current_stock: number;
        reorder_point: number;
        expiry_date: string | null;
        expiry_alert_days: number;
        [key: string]: unknown;
      };

      let result = (items ?? []) as ItemRow[];

      // Filter low stock items in application layer
      if (lowStock) {
        result = result.filter((item) => item.current_stock <= item.reorder_point);
      }

      // Filter expiring items
      if (expiring) {
        const now = new Date();
        result = result.filter((item) => {
          if (!item.expiry_date) return false;
          const expiry = new Date(item.expiry_date);
          const alertDays = item.expiry_alert_days ?? 30;
          const alertDate = new Date(now.getTime() + alertDays * 24 * 60 * 60 * 1000);
          return expiry <= alertDate;
        });
      }

      return apiSuccess({ items: result, total: result.length });
    } catch (err) {
      logger.error("Inventory list failed", {
        context: "api/inventory",
        error: err,
      });
      return apiInternalError("Échec de la récupération de l'inventaire");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);

/**
 * PATCH /api/inventory
 *
 * Update an inventory item's metadata.
 */
export const PATCH = withAuthValidation(
  inventoryItemUpdateSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { itemId, ...updates } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Build update fields from provided data
      const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) updateFields.name = updates.name;
      if (updates.category !== undefined) updateFields.category = updates.category;
      if (updates.sku !== undefined) updateFields.sku = updates.sku;
      if (updates.description !== undefined) updateFields.description = updates.description;
      if (updates.unit !== undefined) updateFields.unit = updates.unit;
      if (updates.minimumStock !== undefined) updateFields.minimum_stock = updates.minimumStock;
      if (updates.maximumStock !== undefined) updateFields.maximum_stock = updates.maximumStock;
      if (updates.reorderPoint !== undefined) updateFields.reorder_point = updates.reorderPoint;
      if (updates.reorderQuantity !== undefined)
        updateFields.reorder_quantity = updates.reorderQuantity;
      if (updates.unitCostCentimes !== undefined)
        updateFields.unit_cost_centimes = updates.unitCostCentimes;
      if (updates.supplierName !== undefined) updateFields.supplier_name = updates.supplierName;
      if (updates.supplierPhone !== undefined) updateFields.supplier_phone = updates.supplierPhone;
      if (updates.supplierEmail !== undefined) updateFields.supplier_email = updates.supplierEmail;
      if (updates.expiryDate !== undefined) updateFields.expiry_date = updates.expiryDate;
      if (updates.expiryAlertDays !== undefined)
        updateFields.expiry_alert_days = updates.expiryAlertDays;
      if (updates.location !== undefined) updateFields.location = updates.location;
      if (updates.isActive !== undefined) updateFields.is_active = updates.isActive;

      const { data: updated, error: updateError } = await untypedSupabase
        .from("inventory_items")
        .update(updateFields)
        .eq("id", itemId)
        .eq("clinic_id", clinicId)
        .select("id, name, category, current_stock, reorder_point")
        .single();

      if (updateError) {
        logger.error("Failed to update inventory item", {
          context: "api/inventory",
          error: updateError,
        });
        return apiError("Article introuvable ou mise à jour échouée", 404, "NOT_FOUND");
      }

      await logAuditEvent({
        supabase,
        action: "inventory_item_updated",
        type: "admin",
        clinicId,
        actor: auth.user.id,
        description: `Inventory item ${itemId} updated`,
        metadata: { itemId, updates: Object.keys(updateFields) },
      });

      return apiSuccess({ item: updated });
    } catch (err) {
      logger.error("Inventory update failed", {
        context: "api/inventory",
        error: err,
      });
      return apiInternalError("Échec de la mise à jour de l'article d'inventaire");
    }
  },
  ["clinic_admin", "receptionist"],
);
