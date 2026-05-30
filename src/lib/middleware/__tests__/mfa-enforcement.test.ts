/**
 * MFA enforcement tests (§3.5).
 *
 * Exercises the real `enforceMfa` from `../mfa-enforcement` with a minimal
 * Supabase mock that returns a configurable Authenticator Assurance Level.
 * Covers the super_admin hard requirement (enrolled + AAL2), the
 * doctor/clinic_admin step-up redirects, and the non-privileged pass-through.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enforceMfa } from "../mfa-enforcement";

type Aal = { currentLevel: string | null; nextLevel: string | null };

function mockSupabase(aal: Aal): SupabaseClient {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: aal }),
      },
    },
  } as unknown as SupabaseClient;
}

const URL_BASE = "https://clinic.oltigo.com";

describe("enforceMfa — disabled by default", () => {
  it("returns null for super_admin when ENFORCE_MFA is not set", async () => {
    delete process.env.ENFORCE_MFA;
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result).toBeNull();
  });

  it("returns null for doctor when ENFORCE_MFA is not set", async () => {
    delete process.env.ENFORCE_MFA;
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "doctor",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result).toBeNull();
  });
});

describe("enforceMfa — super_admin (ENFORCE_MFA=true)", () => {
  beforeEach(() => { process.env.ENFORCE_MFA = "true"; });
  afterEach(() => { delete process.env.ENFORCE_MFA; });
  it("passes when the session is already AAL2", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal2", nextLevel: "aal2" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result).toBeNull();
  });

  it("redirects to login step-up when factors are enrolled but session is AAL1", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/login?mfa=required");
  });

  it("redirects to 2FA setup when no factor is enrolled", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/setup-2fa?required=super_admin");
  });

  it("does not loop-redirect when already on the setup-2fa page", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "super_admin",
      "/setup-2fa",
      `${URL_BASE}/setup-2fa`,
    );
    expect(result).toBeNull();
  });
});

describe("enforceMfa — doctor / clinic_admin mandatory 2FA (ENFORCE_MFA=true)", () => {
  beforeEach(() => { process.env.ENFORCE_MFA = "true"; });
  afterEach(() => { delete process.env.ENFORCE_MFA; });
  it("redirects a doctor with an enrolled-but-unverified factor to login", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "doctor",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/login?mfa=required");
  });

  it("redirects a doctor without enrolled factors to /setup-2fa", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "doctor",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/setup-2fa?required=doctor");
  });

  it("does not loop-redirect a doctor already on /setup-2fa", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "doctor",
      "/setup-2fa",
      `${URL_BASE}/setup-2fa`,
    );
    expect(result).toBeNull();
  });

  it("passes a doctor with AAL2", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal2", nextLevel: "aal2" }),
      "doctor",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result).toBeNull();
  });

  it("redirects a clinic_admin with an unverified factor to login", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "clinic_admin",
      "/admin/settings",
      `${URL_BASE}/admin/settings`,
    );
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/login?mfa=required");
  });

  it("redirects a clinic_admin without enrolled factors to /setup-2fa", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "clinic_admin",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toContain("/setup-2fa?required=clinic_admin");
  });

  it("does not loop-redirect a clinic_admin already on /setup-2fa", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "clinic_admin",
      "/setup-2fa",
      `${URL_BASE}/setup-2fa`,
    );
    expect(result).toBeNull();
  });
});

describe("enforceMfa — non-privileged roles", () => {
  it("never enforces MFA for a patient", async () => {
    const supabase = mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" });
    const result = await enforceMfa(supabase, "patient", "/admin", `${URL_BASE}/admin`);
    expect(result).toBeNull();
    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("never enforces MFA for a receptionist", async () => {
    const supabase = mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" });
    const result = await enforceMfa(supabase, "receptionist", "/admin", `${URL_BASE}/admin`);
    expect(result).toBeNull();
    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });
});
