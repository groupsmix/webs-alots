import type { PromotionRow } from "@/lib/super-admin/types";

// `promotions` (migration 00194) is not yet in the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedClient = { from: (table: string) => any };

interface PromotionDbRow {
  id: string;
  name: string | null;
  discount_percent: number | null;
  tiers: string[] | null;
  start_date: string | null;
  end_date: string | null;
  enabled: boolean | null;
}

export const PROMOTION_COLS = "id, name, discount_percent, tiers, start_date, end_date, enabled";

export function mapPromotion(row: PromotionDbRow): PromotionRow {
  return {
    id: row.id,
    name: row.name ?? "",
    discount: row.discount_percent ?? 0,
    tiers: row.tiers ?? [],
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    enabled: row.enabled ?? true,
  };
}
