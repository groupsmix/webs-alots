import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { inventoryTransactionSchema } from "@/lib/validations/batch4c";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * POST /api/inventory/transaction
 *
 * Record a stock transaction (restock, usage, adjustment, expired, returned).
 * Automatically updates the item's current_stock.
 */
export const POST = withAuthValidation(
  inventoryTransactionSchema,
  async (data, _request, auth) => {
    const tenant = await getTenant();
    if (!tenant?.clinicId) {
      return apiError("Clinic context required — use a clinic subdomain", 400);
    }
    const clinicId = tenant.clinicId;
    const { itemId, type, quantity, reason, referenceId } = data;

    try {
      const supabase = await createTenantClient(clinicId);
      const untypedSupabase = supabase as unknown as SupabaseUntyped;

      // Fetch current stock
      const { data: item, error: fetchError } = await untypedSupabase
        .from("inventory_items")
        .select("id, current_stock, name")
        .eq("id", itemId)
        .eq("clinic_id", clinicId)
        .single();

      if (fetchError || !item) {
        return apiError("Inventory item not found", 404, "NOT_FOUND");
      }

      type ItemRow = { id: string; current_stock: number; name: string };
      const currentItem = item as ItemRow;
      const previousStock = currentItem.current_stock;

      // Calculate new stock based on transaction type
      let newStock: number;
      switch (type) {
        case "restock":
        case "returned":
          newStock = previousStock + quantity;
          break;
        case "usage":
        case "expired":
          newStock = Math.max(0, previousStock - quantity);
          break;
        case "adjustment":
          newStock = quantity; // Absolute value for adjustments
          break;
        default:
          return apiError("Invalid transaction type", 400, "INVALID_TYPE");
      }

      // Record the transaction
      const { data: transaction, error: insertError } = await untypedSupabase
        .from("inventory_transactions")
        .insert({
          clinic_id: clinicId,
          item_id: itemId,
          type,
          quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: reason ?? null,
          performed_by: auth.profile.id,
          reference_id: referenceId ?? null,
        })
        .select("id, type, quantity, previous_stock, new_stock, created_at")
        .single();

      if (insertError) {
        logger.error("Failed to record inventory transaction", {
          context: "api/inventory/transaction",
          error: insertError,
        });
        return apiInternalError("Failed to record transaction");
      }

      // Update item's current stock
      const updateFields: Record<string, unknown> = {
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      };
      if (type === "restock") {
        updateFields.last_restocked_at = new Date().toISOString();
      }

      const { error: updateError } = await untypedSupabase
        .from("inventory_items")
        .update(updateFields)
        .eq("id", itemId)
        .eq("clinic_id", clinicId);

      if (updateError) {
        logger.error("Failed to update item stock after transaction", {
          context: "api/inventory/transaction",
          error: updateError,
        });
        return apiInternalError("Transaction recorded but stock update failed");
      }

      await logAuditEvent({
        supabase,
        action: `inventory_${type}`,
        type: "admin",
        clinicId,
        actor: auth.user.id,
        description: `${type}: ${currentItem.name} (${previousStock} → ${newStock})`,
        metadata: {
          itemId,
          type,
          quantity,
          previousStock,
          newStock,
        },
      });

      return apiSuccess({ transaction, newStock });
    } catch (err) {
      logger.error("Inventory transaction failed", {
        context: "api/inventory/transaction",
        error: err,
      });
      return apiInternalError("Failed to process transaction");
    }
  },
  ["clinic_admin", "receptionist", "doctor"],
);
