import type {
  FeatureDefinition,
  PriceHistoryEntry,
  PricingTierRow,
} from "@/lib/super-admin/types";

type FeatureDefinitionRow = {
  id: string;
  name: string | null;
  description: string | null;
  key: string | null;
  category: string | null;
  available_tiers: string[] | null;
  global_enabled: boolean | null;
};

export function mapFeatureDefinition(row: FeatureDefinitionRow): FeatureDefinition {
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    key: row.key ?? "",
    category: (row.category ?? "core") as FeatureDefinition["category"],
    availableTiers: row.available_tiers ?? [],
    globalEnabled: row.global_enabled ?? true,
  };
}

type PricingTierDbRow = {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  is_popular: boolean | null;
  pricing: unknown;
  features: unknown;
  limits: unknown;
};

const DEFAULT_PRICING_LIMITS: PricingTierRow["limits"] = {
  maxDoctors: 1,
  maxPatients: 0,
  maxAppointmentsPerMonth: 0,
  storageGB: 1,
  customDomain: false,
  apiAccess: false,
  whiteLabel: false,
};

export function mapPricingTierRow(row: PricingTierDbRow): PricingTierRow {
  return {
    id: row.id,
    slug: row.slug ?? "",
    name: row.name ?? "",
    description: row.description ?? "",
    popular: row.is_popular ?? false,
    pricing: (row.pricing as Record<string, { monthly: number; yearly: number }>) ?? {},
    features:
      (row.features as { key: string; label: string; included: boolean; limit?: string }[]) ?? [],
    limits: (row.limits as PricingTierRow["limits"]) ?? DEFAULT_PRICING_LIMITS,
  };
}

export function buildPriceChanges(
  oldPricing: Record<string, { monthly: number; yearly: number }> | null | undefined,
  nextPricing: Record<string, { monthly: number; yearly: number }> | null | undefined,
): {
  system: string;
  cycle: "monthly" | "yearly";
  oldPrice: number;
  newPrice: number;
}[] {
  if (!nextPricing) return [];

  const changes: {
    system: string;
    cycle: "monthly" | "yearly";
    oldPrice: number;
    newPrice: number;
  }[] = [];

  for (const [system, next] of Object.entries(nextPricing)) {
    const previous = oldPricing?.[system];
    if (!previous || previous.monthly !== next.monthly) {
      changes.push({
        system,
        cycle: "monthly",
        oldPrice: previous?.monthly ?? 0,
        newPrice: next.monthly,
      });
    }
    if (!previous || previous.yearly !== next.yearly) {
      changes.push({
        system,
        cycle: "yearly",
        oldPrice: previous?.yearly ?? 0,
        newPrice: next.yearly,
      });
    }
  }

  return changes;
}

type PriceHistoryAuditRow = {
  timestamp: string | null;
  metadata: unknown;
};

export function mapPriceHistoryRows(data: PriceHistoryAuditRow[]): PriceHistoryEntry[] {
  const history: PriceHistoryEntry[] = [];

  for (const log of data) {
    const meta = (log.metadata as Record<string, unknown> | null) ?? {};
    const date = log.timestamp ? log.timestamp.split("T")[0] : "";
    const changes = Array.isArray(meta.priceChanges)
      ? (meta.priceChanges as {
          system: string;
          cycle: string;
          oldPrice: number;
          newPrice: number;
        }[])
      : null;

    if (changes && changes.length > 0) {
      for (const change of changes) {
        history.push({
          date,
          system: change.system,
          cycle: change.cycle,
          oldPrice: change.oldPrice,
          newPrice: change.newPrice,
        });
      }
      continue;
    }

    const pricing =
      (meta.pricing as Record<string, { monthly: number; yearly: number }> | undefined) ?? {};
    const firstSystemKey = Object.keys(pricing)[0];
    const newPriceMonthly = firstSystemKey ? (pricing[firstSystemKey]?.monthly ?? 0) : 0;

    history.push({
      date,
      system: (meta.tierId as string | undefined) || "Unknown",
      cycle: "monthly",
      oldPrice: 0,
      newPrice: newPriceMonthly,
    });
  }

  return history;
}
