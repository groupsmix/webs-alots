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

  it("redirects super_admin to enrollment when no verified TOTP factor exists (R1)", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }, []),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(307);
    expect(result?.headers.get("Location")).toMatch(/\/setup-2fa\?required=1&next=%2Fadmin$/);
  });

  it("treats an unverified (mid-enrolment) factor as not enrolled", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }, [{ status: "unverified" }]),
      "clinic_admin",
      "/admin/settings",
      `${URL_BASE}/admin/settings`,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(307);
    expect(result?.headers.get("Location")).toMatch(/\/setup-2fa\?required=1&next=/);
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
});
