/**
 * Tests for updateFeatureDefinition + bulkSetFeatureTier (Feature Matrix
 * persistence). Verifies the role gate, partial writes, the audit entry
 * (feature type), the bulk add/skip logic, and error propagation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn().mockResolvedValue(undefined);

let updateError: { message: string } | null = null;
let bulkRows: { id: string; available_tiers: string[] }[] = [];

const updateEq = vi.fn(() => Promise.resolve({ error: updateError }));
const update = vi.fn(() => ({ eq: updateEq }));
const single = vi.fn(() => Promise.resolve({ data: { id: "f1", name: "Booking" } }));
const selectEq = vi.fn(() => ({ single }));
// `select` is both chainable (`.eq().single()`) and awaitable (bulk read).
const select = vi.fn(() => ({
  eq: selectEq,
  then: (resolve: (v: { data: typeof bulkRows; error: null }) => void) =>
    resolve({ data: bulkRows, error: null }),
}));
const insert = vi.fn(
  (): Promise<{ error: { message: string } | null }> => Promise.resolve({ error: null }),
);
const from = vi.fn(() => ({ select, update, insert }));

vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: () => Promise.resolve({ from }),
  createAdminClient: () => ({ from }),
}));
vi.mock("@/lib/subdomain-cache", () => ({ invalidateSubdomainCache: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email-templates", () => ({
  staffWelcomeEmail: vi.fn(),
  clinicSuspendedEmail: vi.fn(),
  clinicActivatedEmail: vi.fn(),
}));
vi.mock("@/lib/onboarding/state", () => ({ syncClinicOnboardingState: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

async function load() {
  return await import("@/lib/super-admin-actions");
}

beforeEach(() => {
  vi.clearAllMocks();
  updateError = null;
  bulkRows = [];
});

describe("updateFeatureDefinition", () => {
  it("requires super_admin", async () => {
    const { updateFeatureDefinition } = await load();
    await updateFeatureDefinition("f1", { globalEnabled: false });
    expect(requireRole).toHaveBeenCalledWith("super_admin");
  });

  it("writes only the provided fields + audits with feature type", async () => {
    const { updateFeatureDefinition } = await load();
    await updateFeatureDefinition("f1", { globalEnabled: false });
    expect(update).toHaveBeenCalledWith({ global_enabled: false });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "feature_definition_updated", type: "feature" }),
    );
  });

  it("writes available_tiers when provided", async () => {
    const { updateFeatureDefinition } = await load();
    await updateFeatureDefinition("f1", { availableTiers: ["basic", "premium"] });
    expect(update).toHaveBeenCalledWith({ available_tiers: ["basic", "premium"] });
  });

  it("is a no-op when no fields are provided", async () => {
    const { updateFeatureDefinition } = await load();
    await updateFeatureDefinition("f1", {});
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the update fails", async () => {
    const { updateFeatureDefinition } = await load();
    updateError = { message: "boom" };
    await expect(updateFeatureDefinition("f1", { globalEnabled: true })).rejects.toThrow(
      /Failed to update feature definition/,
    );
  });
});

describe("bulkSetFeatureTier", () => {
  it("adds the tier only to features missing it (skips already-correct)", async () => {
    bulkRows = [
      { id: "f1", available_tiers: ["basic"] },
      { id: "f2", available_tiers: [] },
    ];
    const { bulkSetFeatureTier } = await load();
    await bulkSetFeatureTier("basic", true);
    // f1 already has basic → skipped; f2 missing → updated once.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ available_tiers: ["basic"] });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "feature_tier_bulk_update", type: "feature" }),
    );
  });

  it("removes the tier from features that have it", async () => {
    bulkRows = [
      { id: "f1", available_tiers: ["basic", "premium"] },
      { id: "f2", available_tiers: ["premium"] },
    ];
    const { bulkSetFeatureTier } = await load();
    await bulkSetFeatureTier("basic", false);
    // Only f1 has basic → one update removing it.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ available_tiers: ["premium"] });
  });
});
