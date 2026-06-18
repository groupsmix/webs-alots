/**
 * Persistence guarantees for clinic-admin write actions.
 *
 * Context: an audit checklist claimed that "Add Doctor" / "Add Service" in the
 * admin area only update local React state and silently vanish on refresh, and
 * that receptionists are a hardcoded seed. These tests pin down the opposite —
 * the server actions perform a real Supabase INSERT (scoped to the caller's
 * clinic) and RETURN the persisted row, and they THROW on a DB error (so the UI
 * surfaces a failure toast rather than a phantom success).
 *
 * Pure unit tests: every dependency of admin-actions is mocked, so this runs in
 * CI with no database. The assertions exercise the real createClinicUser /
 * createClinicService code paths from src/lib/admin-actions.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup (hoisted above the module-under-test import) ──────────

const CLINIC_ID = "11110000-1111-1111-1111-111100001111";

/**
 * Chainable Supabase mock. `.insert().select().single()` resolves to whatever
 * `single` is configured to return for the current test. All builder methods
 * return `this` so the call chain in admin-actions resolves correctly.
 */
const chain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn(),
};

const mockSupabase = {
  from: vi.fn(() => chain),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  // createScopedAdminClient is only reached when a service-role key exists;
  // these tests force getSupabaseServiceRoleKey() to "" so it is never used.
  createScopedAdminClient: vi.fn(() => {
    throw new Error("createScopedAdminClient should not be called in this test");
  }),
}));

vi.mock("@/lib/auth", () => ({
  // adminContext() calls requireRole(...) and expects a profile with clinic_id.
  requireRole: vi.fn(async () => ({
    id: "super-admin-1",
    role: "clinic_admin",
    clinic_id: CLINIC_ID,
  })),
}));

vi.mock("@/lib/env", () => ({
  // Force the "no auth account / no welcome email" branch so the test stays
  // focused on the DB insert. The persistence behaviour is identical either way.
  getSupabaseServiceRoleKey: vi.fn(() => ""),
  getSiteUrl: vi.fn(() => "https://oltigo.com"),
}));

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email-templates", () => ({ staffWelcomeEmail: vi.fn(() => ({})) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import AFTER mocks are registered.
import { createClinicUser, createClinicService } from "@/lib/admin-actions";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-prime the chainable defaults cleared by clearMocks.
  chain.insert.mockReturnThis();
  chain.select.mockReturnThis();
  chain.update.mockReturnThis();
  chain.eq.mockReturnThis();
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("createClinicUser — doctor/receptionist persistence", () => {
  it("INSERTs a real row into users, scoped to the caller's clinic, and returns it", async () => {
    const persisted = {
      id: "doctor-row-1",
      clinic_id: CLINIC_ID,
      role: "doctor",
      name: "ZZZ_TEST",
      is_active: true,
    };
    chain.single.mockResolvedValue({ data: persisted, error: null });

    const row = await createClinicUser({
      role: "doctor",
      name: "ZZZ_TEST",
      email: "zzz@test.com",
      metadata: { specialty: "Cardiology" },
    });

    // It hit the real users table…
    expect(mockSupabase.from).toHaveBeenCalledWith("users");
    // …with a payload that is tenant-scoped and carries the role (mass-assignment safe).
    expect(chain.insert).toHaveBeenCalledTimes(1);
    const payload = chain.insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      clinic_id: CLINIC_ID,
      role: "doctor",
      name: "ZZZ_TEST",
      is_active: true,
    });
    // …and returned the DB row (the id the optimistic UI list keys on).
    expect(row.id).toBe("doctor-row-1");
  });

  it("THROWS on a DB error — the UI cannot show a phantom success toast", async () => {
    chain.single.mockResolvedValue({ data: null, error: { message: "duplicate key" } });

    await expect(createClinicUser({ role: "doctor", name: "ZZZ_TEST" })).rejects.toThrow(
      /Failed to create doctor/,
    );
  });

  it("rejects an empty name before touching the database", async () => {
    await expect(createClinicUser({ role: "receptionist", name: "   " })).rejects.toThrow(
      /Name is required/,
    );
    expect(chain.insert).not.toHaveBeenCalled();
  });
});

describe("createClinicService — service persistence", () => {
  it("INSERTs a real row into services scoped to the clinic and returns it", async () => {
    const persisted = { id: "svc-1", clinic_id: CLINIC_ID, name: "ZZZ_TEST", is_active: true };
    chain.single.mockResolvedValue({ data: persisted, error: null });

    const row = await createClinicService({
      name: "ZZZ_TEST",
      duration_minutes: 30,
      price: 200,
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("services");
    const payload = chain.insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      clinic_id: CLINIC_ID,
      name: "ZZZ_TEST",
      duration_minutes: 30,
      currency: "MAD",
    });
    expect(row.id).toBe("svc-1");
  });

  it("THROWS on a DB error instead of reporting success", async () => {
    chain.single.mockResolvedValue({ data: null, error: { message: "constraint" } });
    await expect(createClinicService({ name: "ZZZ_TEST", duration_minutes: 30 })).rejects.toThrow(
      /Failed to create service/,
    );
  });
});
