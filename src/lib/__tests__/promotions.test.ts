/**
 * Tests for the promotions server actions (super-admin Pricing > Promotions).
 * Verifies the role gate, mapping, create/delete/enable persistence, the
 * billing audit entries, and error propagation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn().mockResolvedValue(undefined);

let promoRows: Array<Record<string, unknown>> = [];
let createdRow: Record<string, unknown> = {};
let createError: { message: string } | null = null;
let mutError: { message: string } | null = null;

const order = vi.fn(() => Promise.resolve({ data: promoRows, error: null }));
const select = vi.fn(() => ({ order }));
const single = vi.fn(() => Promise.resolve({ data: createdRow, error: createError }));
const insertSelect = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({
  select: insertSelect,
  then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
}));
const mutEq = vi.fn(() => Promise.resolve({ error: mutError }));
const update = vi.fn(() => ({ eq: mutEq }));
const del = vi.fn(() => ({ eq: mutEq }));
const from = vi.fn(() => ({ select, insert, update, delete: del }));

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
  promoRows = [];
  createdRow = {};
  createError = null;
  mutError = null;
});

describe("fetchPromotions", () => {
  it("maps DB rows to the client shape", async () => {
    promoRows = [
      {
        id: "p1",
        name: "Summer",
        discount_percent: 20,
        tiers: ["pro"],
        start_date: "2026-06-01",
        end_date: "2026-07-01",
        enabled: true,
      },
    ];
    const { fetchPromotions } = await load();
    const result = await fetchPromotions();
    expect(requireRole).toHaveBeenCalledWith("super_admin");
    expect(result).toEqual([
      {
        id: "p1",
        name: "Summer",
        discount: 20,
        tiers: ["pro"],
        startDate: "2026-06-01",
        endDate: "2026-07-01",
        enabled: true,
      },
    ]);
  });
});

describe("createPromotion", () => {
  it("inserts mapped columns, audits (billing), and returns the created row", async () => {
    createdRow = {
      id: "p2",
      name: "Launch",
      discount_percent: 15,
      tiers: ["premium"],
      start_date: null,
      end_date: null,
      enabled: true,
    };
    const { createPromotion } = await load();
    const result = await createPromotion({
      name: "Launch",
      discount: 15,
      tiers: ["premium"],
      startDate: "",
      endDate: "",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Launch",
        discount_percent: 15,
        tiers: ["premium"],
        start_date: null,
        end_date: null,
        enabled: true,
      }),
    );
    // Audit entry (billing type) on activity_logs.
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "promotion_created", type: "billing" }),
    );
    expect(result.id).toBe("p2");
    expect(result.discount).toBe(15);
  });

  it("throws when the insert fails", async () => {
    createError = { message: "boom" };
    const { createPromotion } = await load();
    await expect(
      createPromotion({ name: "X", discount: 5, tiers: [], startDate: "", endDate: "" }),
    ).rejects.toThrow(/Failed to create promotion/);
  });
});

describe("setPromotionEnabled", () => {
  it("updates the enabled flag", async () => {
    const { setPromotionEnabled } = await load();
    await setPromotionEnabled("p1", false);
    expect(update).toHaveBeenCalledWith({ enabled: false });
    expect(mutEq).toHaveBeenCalledWith("id", "p1");
  });

  it("throws when the update fails", async () => {
    mutError = { message: "nope" };
    const { setPromotionEnabled } = await load();
    await expect(setPromotionEnabled("p1", true)).rejects.toThrow(/Failed to update promotion/);
  });
});

describe("deletePromotion", () => {
  it("deletes the row and writes a billing audit entry", async () => {
    const { deletePromotion } = await load();
    await deletePromotion("p1");
    expect(del).toHaveBeenCalled();
    expect(mutEq).toHaveBeenCalledWith("id", "p1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "promotion_deleted", type: "billing" }),
    );
  });

  it("throws when the delete fails", async () => {
    mutError = { message: "denied" };
    const { deletePromotion } = await load();
    await expect(deletePromotion("p1")).rejects.toThrow(/Failed to delete promotion/);
  });
});
