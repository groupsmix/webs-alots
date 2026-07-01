/**
 * MFA enforcement tests (§3.5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enforceMfa } from "../mfa-enforcement";

type Aal = { currentLevel: string | null; nextLevel: string | null };
type Factor = { status: string };

function mockSupabase(aal: Aal, totpFactors: Factor[] = [{ status: "verified" }]): SupabaseClient {
  return {
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: totpFactors } }),
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: aal }),
      },
    },
  } as unknown as SupabaseClient;
}

const URL_BASE = "https://clinic.oltigo.com";

describe("enforceMfa", () => {
  const originalEnv = process.env.MFA_ENABLED;

  beforeEach(() => {
    process.env.MFA_ENABLED = "true";
  });

  afterEach(() => {
    process.env.MFA_ENABLED = originalEnv;
  });

  it("redirects super_admin to MFA verification if AAL2 is required but not met", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(307);
    expect(result?.headers.get("Location")).toMatch(/\/mfa-verify\?next=%2Fadmin$/);
  });

  it("passes super_admin if AAL2 is already met", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal2", nextLevel: "aal2" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result).toBeNull();
  });

  it("redirects clinic_admin to MFA verification if AAL2 is required but not met", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "clinic_admin",
      "/admin/settings",
      `${URL_BASE}/admin/settings`,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(307);
    expect(result?.headers.get("Location")).toMatch(/\/mfa-verify\?next=%2Fadmin%2Fsettings$/);
  });

  it("passes clinic_admin if AAL2 is already met", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal2", nextLevel: "aal2" }),
      "clinic_admin",
      "/admin/settings",
      `${URL_BASE}/admin/settings`,
    );
    expect(result).toBeNull();
  });

  it("passes super_admin with no enrolled factor (enrollment is optional)", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }, []),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    // Optional-enrollment model: an un-enrolled admin is NOT forced to /setup-2fa.
    expect(result).toBeNull();
  });

  it("passes clinic_admin with only an unverified (mid-enrolment) factor", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }, [{ status: "unverified" }]),
      "clinic_admin",
      "/admin/settings",
      `${URL_BASE}/admin/settings`,
    );
    // No verified factor → Supabase reports nextLevel "aal1" → pass-through.
    expect(result).toBeNull();
  });

  it("passes doctor without MFA (not required for role)", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "doctor",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result).toBeNull();
  });

  it("passes patient without MFA (not required for role)", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "patient",
      "/booking",
      `${URL_BASE}/booking`,
    );
    expect(result).toBeNull();
  });

  it("passes receptionist without MFA (not required for role)", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "receptionist",
      "/reception",
      `${URL_BASE}/reception`,
    );
    expect(result).toBeNull();
  });

  describe("when MFA_ENABLED=false", () => {
    beforeEach(() => {
      process.env.MFA_ENABLED = "false";
    });

    it("passes super_admin even if AAL2 is required but not met", async () => {
      const result = await enforceMfa(
        mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
        "super_admin",
        "/admin",
        `${URL_BASE}/admin`,
      );
      expect(result).toBeNull();
    });
  });

  describe("mandatory super_admin enrolment (ENFORCE_SUPER_ADMIN_MFA)", () => {
    const originalEnforce = process.env.ENFORCE_SUPER_ADMIN_MFA;

    afterEach(() => {
      process.env.ENFORCE_SUPER_ADMIN_MFA = originalEnforce;
    });

    it("does NOT force un-enrolled super_admin to /setup-2fa when the flag is off (default)", async () => {
      delete process.env.ENFORCE_SUPER_ADMIN_MFA;
      const result = await enforceMfa(
        mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
        "super_admin",
        "/super-admin/dashboard",
        `${URL_BASE}/super-admin/dashboard`,
      );
      expect(result).toBeNull();
    });

    it("redirects un-enrolled super_admin to /setup-2fa when the flag is on", async () => {
      process.env.ENFORCE_SUPER_ADMIN_MFA = "true";
      const result = await enforceMfa(
        mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
        "super_admin",
        "/super-admin/dashboard",
        `${URL_BASE}/super-admin/dashboard`,
      );
      expect(result).not.toBeNull();
      expect(result?.status).toBe(307);
      expect(result?.headers.get("Location")).toMatch(
        /\/setup-2fa\?next=%2Fsuper-admin%2Fdashboard$/,
      );
    });

    it("does NOT force clinic_admin to enrol even when the flag is on (super_admin only)", async () => {
      process.env.ENFORCE_SUPER_ADMIN_MFA = "true";
      const result = await enforceMfa(
        mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
        "clinic_admin",
        "/admin",
        `${URL_BASE}/admin`,
      );
      expect(result).toBeNull();
    });

    it("passes an already-enrolled super_admin at AAL2 when the flag is on", async () => {
      process.env.ENFORCE_SUPER_ADMIN_MFA = "true";
      const result = await enforceMfa(
        mockSupabase({ currentLevel: "aal2", nextLevel: "aal2" }),
        "super_admin",
        "/super-admin/dashboard",
        `${URL_BASE}/super-admin/dashboard`,
      );
      expect(result).toBeNull();
    });

    it("still step-ups an enrolled-but-AAL1 super_admin to /mfa-verify (not /setup-2fa) when the flag is on", async () => {
      process.env.ENFORCE_SUPER_ADMIN_MFA = "true";
      const result = await enforceMfa(
        mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
        "super_admin",
        "/super-admin/dashboard",
        `${URL_BASE}/super-admin/dashboard`,
      );
      expect(result?.headers.get("Location")).toMatch(/\/mfa-verify\?next=/);
    });
  });
});
