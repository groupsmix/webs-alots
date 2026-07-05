import { logger } from "@/lib/logger";
import {
  mapPromotion,
  PROMOTION_COLS,
  type UntypedClient,
} from "@/lib/super-admin/helpers";
import type { PromotionRow } from "@/lib/super-admin/types";

export async function fetchPromotionsImpl(supabase: UntypedClient): Promise<PromotionRow[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(PROMOTION_COLS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(mapPromotion);
}

export async function createPromotionImpl(
  supabase: UntypedClient,
  input: {
    name: string;
    discount: number;
    tiers: string[];
    startDate: string;
    endDate: string;
  },
): Promise<PromotionRow> {
  const { data, error } = await supabase
    .from("promotions")
    .insert({
      name: input.name,
      discount_percent: input.discount,
      tiers: input.tiers,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      enabled: true,
    })
    .select(PROMOTION_COLS)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create promotion: ${error?.message ?? "no data"}`);
  }

  try {
    await supabase // nosemgrep: semgrep.tenant-scoping — global super-admin audit event (promotions are platform-wide, no clinic context)
      .from("activity_logs")
      .insert({
        action: "promotion_created",
        description: `Promotion "${input.name}" created`,
        type: "billing",
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", { context: "super-admin-actions", error: err });
  }

  return mapPromotion(data);
}

export async function setPromotionEnabledImpl(
  supabase: UntypedClient,
  id: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase.from("promotions").update({ enabled }).eq("id", id);

  if (error) throw new Error(`Failed to update promotion: ${error.message}`);
}

export async function deletePromotionImpl(supabase: UntypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete promotion: ${error.message}`);

  try {
    await supabase // nosemgrep: semgrep.tenant-scoping — global super-admin audit event (promotions are platform-wide, no clinic context)
      .from("activity_logs")
      .insert({
        action: "promotion_deleted",
        description: `Promotion ${id} deleted`,
        type: "billing",
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", { context: "super-admin-actions", error: err });
  }
}
