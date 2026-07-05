/**
 * Tests for updatePricingTier and fetchPriceHistory (super-admin pricing
 * persistence + audit trail). Verifies the role gate, partial-field writes,
 * the audit entry (billing type), the no-op path, error propagation, and
 * (Deep-Dive P4) that price changes are audited with a real structured
 * before/after diff instead of a lossy `oldPrice: 0` reconstruction.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn().mockResolvedValue(undefined);

type PricingRow = {
  id: string;
  name: string;
  pricing?: Record<string, { monthly: number; yearly: number }>;
};

let updateError: { message: string } | null = null;
let existingRow: PricingRow = { id: "t1", name: "Pro" };
let historyRows: { timestamp: string; metadata: unknown; description: string }[] = [];

const updateEq = vi.fn(() => Promise.resolve({ error: updateError }));
const update = vi.fn(() => ({ eq: updateEq }));
const single = vi.fn(() => Promise.resolve({ data: existingRow }));
const limit = vi.fn(() => Promise.resolve({ data: historyRows, error: null }));
const order = vi.fn(() => ({ limit }));
const selectEq = vi.fn(() => ({ single, order }));
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

async function loadHistory() {
  const mod = await import("@/lib/super-admin-actions");
  return mod.fetchPriceHistory;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateError = null;
  existingRow = { id: "t1", name: "Pro" };
  historyRows = [];
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

  it("audits a real before/after diff only for the (system, cycle) that changed", async () => {
    existingRow = { id: "t1", name: "Pro", pricing: { doctor: { monthly: 400, yearly: 4000 } } };
    const updatePricingTier = await loadAction();
    await updatePricingTier("t1", {
      pricing: { doctor: { monthly: 499, yearly: 4000 } },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          priceChanges: [{ system: "doctor", cycle: "monthly", oldPrice: 400, newPrice: 499 }],
        }),
      }),
    );
  });

  it("treats a system with no prior pricing as a diff from 0 on both cycles", async () => {
    existingRow = { id: "t1", name: "Pro", pricing: {} };
    const updatePricingTier = await loadAction();
    await updatePricingTier("t1", {
      pricing: { dentist: { monthly: 300, yearly: 3000 } },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          priceChanges: [
            { system: "dentist", cycle: "monthly", oldPrice: 0, newPrice: 300 },
            { system: "dentist", cycle: "yearly", oldPrice: 0, newPrice: 3000 },
          ],
        }),
      }),
    );
  });
});

describe("fetchPriceHistory", () => {
  it("returns the real old/new price from a structured priceChanges diff", async () => {
    historyRows = [
      {
        timestamp: "2026-07-01T10:00:00.000Z",
        description: 'Pricing tier "Pro" updated',
        metadata: {
          tierId: "t1",
          priceChanges: [{ system: "doctor", cycle: "monthly", oldPrice: 400, newPrice: 499 }],
        },
      },
    ];
    const fetchPriceHistory = await loadHistory();
    const history = await fetchPriceHistory();

    expect(history).toEqual([
      { date: "2026-07-01", system: "doctor", cycle: "monthly", oldPrice: 400, newPrice: 499 },
    ]);
  });

  it("falls back to the legacy best-effort reconstruction for older audit rows", async () => {
    historyRows = [
      {
        timestamp: "2026-01-01T10:00:00.000Z",
        description: 'Pricing tier "Pro" updated',
        metadata: {
          tierId: "t1",
          pricing: { doctor: { monthly: 499, yearly: 4990 } },
        },
      },
    ];
    const fetchPriceHistory = await loadHistory();
    const history = await fetchPriceHistory();

    expect(history).toEqual([
      { date: "2026-01-01", system: "t1", cycle: "monthly", oldPrice: 0, newPrice: 499 },
    ]);
  });
});
