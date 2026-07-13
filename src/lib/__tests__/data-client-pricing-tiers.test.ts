import { describe, it, expect, vi } from "vitest";
import { fetchActivePricingTiers } from "@/lib/data/client";
import { createClient } from "@/lib/supabase-client";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/supabase-client", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

describe("fetchActivePricingTiers", () => {
  it("reads active tiers via the tenant-scoped client and maps rows", async () => {
    const supabase = createMockSupabaseClient({
      pricing_tiers: [
        {
          id: "tier-cabinet",
          slug: "cabinet",
          name: "Cabinet",
          description: "Pour un cabinet",
          is_popular: true,
          pricing: { doctor: { monthly: 299, yearly: 2990 } },
          features: [],
          limits: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    vi.mocked(createClient).mockReturnValue(supabase as never);

    const tiers = await fetchActivePricingTiers();

    expect(tiers).toHaveLength(1);
    expect(tiers[0].slug).toBe("cabinet");
    expect(tiers[0].popular).toBe(true);
    expect(tiers[0].pricing.doctor.monthly).toBe(299);
  });

  it("returns an empty array when there are no active tiers", async () => {
    const supabase = createMockSupabaseClient({ pricing_tiers: [] });
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const tiers = await fetchActivePricingTiers();

    expect(tiers).toEqual([]);
  });
});
