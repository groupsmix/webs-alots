/**
 * Tests for deleteClinic (super-admin permanent clinic deletion).
 *
 * Verifies the super_admin role gate, the patient-PHI safety guard
 * (refuse unless force), the clinic-scoped audit entry, the service-role
 * delete, subdomain-cache invalidation, and error propagation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mutable fixtures ─────────────────────────────────────────────────
let clinicRow: { id: string; name: string; subdomain: string | null } | null = {
  id: "c1",
  name: "Clinic A",
  subdomain: "clinic-a",
};
let clinicFetchError: { message: string } | null = null;
let patientCount = 0;
let deleteError: { message: string } | null = null;

// ── Mock chains ──────────────────────────────────────────────────────
const requireRole = vi.fn().mockResolvedValue({ name: "Super Admin" });
const assertClinicId = vi.fn();
const invalidateSubdomainCache = vi.fn();

const clinicsSingle = vi.fn(() => Promise.resolve({ data: clinicRow, error: clinicFetchError }));
const clinicsSelectEq = vi.fn(() => ({ single: clinicsSingle }));
const clinicsSelect = vi.fn(() => ({ eq: clinicsSelectEq }));

// patient count: select(id, {count, head}).eq("clinic_id").eq("role") -> {count}
const usersEq2 = vi.fn(() => Promise.resolve({ count: patientCount, error: null }));
const usersEq1 = vi.fn(() => ({ eq: usersEq2 }));
const usersSelect = vi.fn(() => ({ eq: usersEq1 }));

const insert = vi.fn((_row?: Record<string, unknown>) => Promise.resolve({ error: null }));

const deleteEq = vi.fn(() => Promise.resolve({ error: deleteError }));
const del = vi.fn(() => ({ eq: deleteEq }));

const cookieFrom = vi.fn((table: string) => {
  if (table === "clinics") return { select: clinicsSelect };
  if (table === "users") return { select: usersSelect };
  if (table === "activity_logs") return { insert };
  return {};
});
const adminFrom = vi.fn((table: string) => {
  if (table === "clinics") return { delete: del };
  return {};
});

vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@/lib/assert-tenant", () => ({
  assertClinicId: (...a: unknown[]) => assertClinicId(...a),
}));
vi.mock("@/lib/supabase-server", () => ({
  createClient: () => Promise.resolve({ from: cookieFrom }),
  createAdminClient: () => ({ from: adminFrom }),
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
  return mod.deleteClinic;
}

beforeEach(() => {
  vi.clearAllMocks();
  clinicRow = { id: "c1", name: "Clinic A", subdomain: "clinic-a" };
  clinicFetchError = null;
  patientCount = 0;
  deleteError = null;
});

describe("deleteClinic", () => {
  it("requires the super_admin role and validates the id", async () => {
    const deleteClinic = await loadAction();
    await deleteClinic("c1");
    expect(requireRole).toHaveBeenCalledWith("super_admin");
    expect(assertClinicId).toHaveBeenCalledWith("c1", expect.any(String));
  });

  it("deletes an empty clinic and reports zero patients erased", async () => {
    const deleteClinic = await loadAction();
    const result = await deleteClinic("c1");
    expect(del).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("id", "c1");
    expect(result).toEqual({ deleted: true, patientCount: 0 });
  });

  it("writes a clinic-scoped audit entry before deleting", async () => {
    const deleteClinic = await loadAction();
    await deleteClinic("c1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "clinic_deleted", type: "clinic" }),
    );
    const auditArg = (insert.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(auditArg.clinic_id).toBe("c1");
  });

  it("invalidates the subdomain cache for the deleted clinic", async () => {
    const deleteClinic = await loadAction();
    await deleteClinic("c1");
    expect(invalidateSubdomainCache).toHaveBeenCalledWith("clinic-a");
  });

  it("refuses to delete a clinic that still has patients (no force)", async () => {
    const deleteClinic = await loadAction();
    patientCount = 3;
    await expect(deleteClinic("c1")).rejects.toThrow(/Refusing to delete/);
    expect(del).not.toHaveBeenCalled();
  });

  it("force-deletes a clinic with patients and reports the count erased", async () => {
    const deleteClinic = await loadAction();
    patientCount = 3;
    const result = await deleteClinic("c1", { force: true });
    expect(del).toHaveBeenCalled();
    expect(result).toEqual({ deleted: true, patientCount: 3 });
  });

  it("throws a clear error when the clinic does not exist", async () => {
    const deleteClinic = await loadAction();
    clinicRow = null;
    clinicFetchError = { message: "no rows" };
    await expect(deleteClinic("c1")).rejects.toThrow(/Clinic not found/);
  });

  it("propagates a delete failure", async () => {
    const deleteClinic = await loadAction();
    deleteError = { message: "fk violation" };
    await expect(deleteClinic("c1")).rejects.toThrow(/Failed to delete clinic/);
  });
});
