import { type NextRequest, NextResponse } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { validateQuery } from "@/lib/api-validate";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { inventoryAlertsSchema } from "@/lib/validations/batch4c";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/inventory/alerts?category=...&alertType=low_stock|expiring|all
 *
 * Get inventory alerts: items below reorder point and/or approaching expiry.
 * Supports auto-reorder suggestions.
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

      const parsed = validateQuery(inventoryAlertsSchema, request);
      if (parsed instanceof NextResponse) return parsed;
      const { category, alertType = "all" } = parsed.data;

      // Fetch all active items for this clinic
      let query = untypedSupabase
        .from("inventory_items")
        .select(
          "id, name, category, sku, current_stock, minimum_stock, reorder_point, reorder_quantity, unit_cost_centimes, supplier_name, supplier_phone, supplier_email, expiry_date, expiry_alert_days, location",
        )
        .eq("clinic_id", clinicId)
        .eq("is_active", true);

      if (category) query = query.eq("category", category);

      const { data: items, error } = await query;

      if (error) {
        logger.error("Failed to fetch inventory for alerts", {
          context: "api/inventory/alerts",
          error,
        });
        return apiInternalError("Échec de la récupération des alertes d'inventaire");
      }

      type ItemRow = {
        id: string;
        name: string;
        category: string;
        sku: string | null;
        current_stock: number;
        minimum_stock: number;
        reorder_point: number;
        reorder_quantity: number;
        unit_cost_centimes: number | null;
        supplier_name: string | null;
        supplier_phone: string | null;
        supplier_email: string | null;
        expiry_date: string | null;
        expiry_alert_days: number;
        location: string | null;
      };

      const allItems = (items ?? []) as ItemRow[];
      const now = new Date();

      // Low stock alerts
      const lowStockAlerts =
        alertType === "all" || alertType === "low_stock"
          ? allItems
              .filter((item) => item.current_stock <= item.reorder_point)
              .map((item) => ({
                id: item.id,
                name: item.name,
                category: item.category,
                sku: item.sku,
                currentStock: item.current_stock,
                reorderPoint: item.reorder_point,
                suggestedReorderQuantity: item.reorder_quantity,
                estimatedCost: item.unit_cost_centimes
                  ? (item.reorder_quantity * item.unit_cost_centimes) / 100
                  : null,
                supplier: item.supplier_name
                  ? {
                      name: item.supplier_name,
                      phone: item.supplier_phone,
                      email: item.supplier_email,
                    }
                  : null,
                location: item.location,
                alertLevel:
                  item.current_stock === 0
                    ? "critical"
                    : item.current_stock <= item.minimum_stock
                      ? "warning"
                      : "info",
              }))
          : [];

      // Expiry alerts
      const expiryAlerts =
        alertType === "all" || alertType === "expiring"
          ? allItems
              .filter((item) => {
                if (!item.expiry_date) return false;
                const expiry = new Date(item.expiry_date);
                const alertDate = new Date(
                  now.getTime() + item.expiry_alert_days * 24 * 60 * 60 * 1000,
                );
                return expiry <= alertDate;
              })
              .map((item) => {
                const expiry = new Date(item.expiry_date!);
                const daysUntilExpiry = Math.ceil(
                  (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
                );
                return {
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  sku: item.sku,
                  currentStock: item.current_stock,
                  expiryDate: item.expiry_date,
                  daysUntilExpiry,
                  location: item.location,
                  alertLevel:
                    daysUntilExpiry <= 0 ? "critical" : daysUntilExpiry <= 7 ? "warning" : "info",
                };
              })
          : [];

      return apiSuccess({
        lowStock: lowStockAlerts,
        expiring: expiryAlerts,
        summary: {
          totalLowStock: lowStockAlerts.length,
          totalExpiring: expiryAlerts.length,
          criticalCount:
            lowStockAlerts.filter((a) => a.alertLevel === "critical").length +
            expiryAlerts.filter((a) => a.alertLevel === "critical").length,
        },
      });
    } catch (err) {
      logger.error("Inventory alerts failed", {
        context: "api/inventory/alerts",
        error: err,
      });
      return apiInternalError("Échec de la récupération des alertes");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);
