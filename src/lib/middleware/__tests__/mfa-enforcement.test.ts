/**
 * MFA enforcement tests (§3.5).
 *
 * MFA enforcement is currently disabled — enforceMfa always returns null.
 * These tests verify that behavior for all roles.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi } from "vitest";
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

describe("enforceMfa — disabled", () => {
  it("passes super_admin without MFA", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "super_admin",
      "/admin",
      `${URL_BASE}/admin`,
    );
    expect(result).toBeNull();
  });

  it("passes doctor without MFA", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "doctor",
      "/dashboard",
      `${URL_BASE}/dashboard`,
    );
    expect(result).toBeNull();
  });

  it("passes clinic_admin without MFA", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "clinic_admin",
      "/admin/settings",
      `${URL_BASE}/admin/settings`,
    );
    expect(result).toBeNull();
  });

  it("passes patient without MFA", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal2" }),
      "patient",
      "/booking",
      `${URL_BASE}/booking`,
    );
    expect(result).toBeNull();
  });

  it("passes receptionist without MFA", async () => {
    const result = await enforceMfa(
      mockSupabase({ currentLevel: "aal1", nextLevel: "aal1" }),
      "receptionist",
      "/reception",
      `${URL_BASE}/reception`,
    );
    expect(result).toBeNull();
  });
});
