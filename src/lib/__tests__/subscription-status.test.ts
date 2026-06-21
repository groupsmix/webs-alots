/**
 * Tests for updateSubscriptionStatus (super-admin subscription persistence).
 *
 * A "subscription" status maps to the clinic's lifecycle status:
 *   activate -> active, suspend -> suspended, cancel -> inactive.
 * Verifies the DB write, the audit-log entry, subdomain-cache invalidation,
 * the super_admin role gate, and error propagation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock setup ───────────────────────────────────────────────────────

const requireRole = vi.fn().mockResolvedValue(undefined);
const invalidateSubdomainCache = vi.fn();

let updateError: { message: string } | null = null;
const updateEq = vi.fn(() => Promise.resolve({ error: updateError }));
const update = vi.fn(() => ({ eq: updateEq }));
const single = vi.fn(() =>
  Promise.resolve({ data: { id: "c1", name: "Clinic A", subdomain: "clinic-a" } }),
);
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
vi.mock("@/lib/subdomain-cache", () => ({
  invalidateSubdomainCache: (...a: unknown[]) => invalidateSubdomainCache(...a),
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email-templates", () => ({
  staffWelcomeEmail: vi.fn(),
  clinicSuspendedEmail: vi.fn(),
  clinicActivatedEmail: vi.fn(),
}));
vi.mock("@/lib/onboarding/state", () => ({ syncClinicOnboardingState: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

async function loadAction() {
  const mod = await import("@/lib/super-admin-actions");
  return mod.updateSubscriptionStatus;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateError = null;
});

describe("updateSubscriptionStatus", () => {
  it("requires the super_admin role", async () => {
    const updateSubscriptionStatus = await loadAction();
    await updateSubscriptionStatus("c1", "activate");
    expect(requireRole).toHaveBeenCalledWith("super_admin");
  });

  it("activate -> clinics.status 'active' + audit 'subscription_activated'", async () => {
    const updateSubscriptionStatus = await loadAction();
    await updateSubscriptionStatus("c1", "activate");
    expect(update).toHaveBeenCalledWith({ status: "active" });
    expect(updateEq).toHaveBeenCalledWith("id", "c1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "subscription_activated",
        clinic_id: "c1",
        clinic_name: "Clinic A",
        type: "billing",
      }),
    );
  });

  it("suspend -> clinics.status 'suspended' + audit 'subscription_suspended'", async () => {
    const updateSubscriptionStatus = await loadAction();
    await updateSubscriptionStatus("c1", "suspend");
    expect(update).toHaveBeenCalledWith({ status: "suspended" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "subscription_suspended" }),
    );
  });

  it("cancel -> clinics.status 'inactive' + audit 'subscription_cancelled'", async () => {
    const updateSubscriptionStatus = await loadAction();
    await updateSubscriptionStatus("c1", "cancel");
    expect(update).toHaveBeenCalledWith({ status: "inactive" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "subscription_cancelled" }),
    );
  });

  it("invalidates the subdomain cache for the clinic", async () => {
    const updateSubscriptionStatus = await loadAction();
    await updateSubscriptionStatus("c1", "suspend");
    expect(invalidateSubdomainCache).toHaveBeenCalledWith("clinic-a");
  });

  it("throws when the DB update fails", async () => {
    const updateSubscriptionStatus = await loadAction();
    updateError = { message: "boom" };
    await expect(updateSubscriptionStatus("c1", "activate")).rejects.toThrow(
      /Failed to update subscription status/,
    );
  });

  it("does not throw if the audit-log insert fails (non-blocking)", async () => {
    const updateSubscriptionStatus = await loadAction();
    insert.mockResolvedValueOnce({ error: { message: "audit down" } });
    await expect(updateSubscriptionStatus("c1", "activate")).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({ status: "active" });
  });
});
