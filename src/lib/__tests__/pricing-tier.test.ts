/**
 * Tests for updatePricingTier (super-admin pricing persistence).
 * Verifies the role gate, partial-field writes, the audit entry (billing type),
 * the no-op path, and error propagation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn().mockResolvedValue(undefined);

let updateError: { message: string } | null = null;
const updateEq = vi.fn(() => Promise.resolve({ error: updateError }));
const update = vi.fn(() => ({ eq: updateEq }));
const single = vi.fn(() => Promise.resolve({ data: { id: "t1", name: "Pro" } }));
const selectEq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq: selectEq }));
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

async function loadAction() {
  const mod = await import("@/lib/super-admin-actions");
  return mod.updatePricingTier;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateError = null;
});

describe("updatePricingTier", () => {
  it("requires the super_admin role", async () => {
    const updatePricingTier = await loadAction();
    await updatePricingTier("t1", { name: "Pro+" });
    expect(requireRole).toHaveBeenCalledWith("super_admin");
  });

  it("writes only the provided fields", async () => {
    const updatePricingTier = await loadAction();
    const pricing = { doctor: { monthly: 499, yearly: 4990 } };
    await updatePricingTier("t1", { name: "Pro+", pricing });
    expect(update).toHaveBeenCalledWith({ name: "Pro+", pricing });
    expect(updateEq).toHaveBeenCalledWith("id", "t1");
  });

  it("audit-logs the change with the billing type", async () => {
    const updatePricingTier = await loadAction();
    await updatePricingTier("t1", { name: "Pro+" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pricing_tier_updated", type: "billing" }),
    );
  });

  it("is a no-op when no fields are provided (no DB write)", async () => {
    const updatePricingTier = await loadAction();
    await updatePricingTier("t1", {});
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the DB update fails", async () => {
    const updatePricingTier = await loadAction();
    updateError = { message: "boom" };
    await expect(updatePricingTier("t1", { name: "X" })).rejects.toThrow(
      /Failed to update pricing tier/,
    );
  });
});
