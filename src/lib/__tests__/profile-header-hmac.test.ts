/**
 * Regression tests for the profile-header HMAC helper.
 *
 * Audit fixes covered:
 *   R-01: When no HMAC key is configured, sign returns null and verify
 *         rejects every header — including a request that "looks valid"
 *         and would previously have been accepted via the literal
 *         "fallback_secret_key".
 *   R-02: PROFILE_HEADER_HMAC_KEY is read first; CRON_SECRET only acts
 *         as a transitional fallback. Headers signed with one key MUST
 *         NOT verify under the other.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signProfileHeader,
  verifyProfileHeader,
  PROFILE_HEADER_NAMES,
} from "@/lib/profile-header-hmac";

const ORIGINAL_PROFILE_KEY = process.env.PROFILE_HEADER_HMAC_KEY;
const ORIGINAL_CRON = process.env.CRON_SECRET;

function clearKeys() {
  delete process.env.PROFILE_HEADER_HMAC_KEY;
  delete process.env.CRON_SECRET;
}

function restoreKeys() {
  if (ORIGINAL_PROFILE_KEY === undefined) delete process.env.PROFILE_HEADER_HMAC_KEY;
  else process.env.PROFILE_HEADER_HMAC_KEY = ORIGINAL_PROFILE_KEY;
  if (ORIGINAL_CRON === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_CRON;
}

describe("profile-header-hmac", () => {
  beforeEach(() => {
    clearKeys();
  });

  afterEach(() => {
    restoreKeys();
    vi.restoreAllMocks();
  });

  it("exposes the canonical header names", () => {
    expect(PROFILE_HEADER_NAMES).toEqual({
      id: "x-auth-profile-id",
      role: "x-auth-profile-role",
      clinic: "x-auth-profile-clinic",
      sig: "x-auth-profile-sig",
    });
  });

  describe("R-01: no fallback key", () => {
    it("signProfileHeader returns null when no key is configured", async () => {
      const sig = await signProfileHeader({
        id: "profile-1",
        role: "super_admin",
        clinic_id: null,
      });
      expect(sig).toBeNull();
    });

    it("verifyProfileHeader rejects forged headers when no key is configured", async () => {
      // An attacker submits headers that *look* valid. With no configured
      // HMAC key there is nothing to verify against, so verification MUST
      // fail (the previous fallback literal would have accepted this).
      const result = await verifyProfileHeader({
        id: "attacker-profile-id",
        role: "super_admin",
        clinic_id: "victim-clinic",
        signature: "a".repeat(64),
      });
      expect(result).toBeNull();
    });

    it("verifyProfileHeader rejects headers signed with the literal 'fallback_secret_key'", async () => {
      // Demonstrates the previous vulnerability: a signature produced
      // with the public fallback key MUST NOT verify under the new code,
      // regardless of whether any key is configured.
      const profile = { id: "p", role: "super_admin", clinic_id: "c" };
      const fallbackSig = await signWithRawKey("fallback_secret_key", profile);

      // Case A: no key configured — must reject.
      let result = await verifyProfileHeader({ ...profile, signature: fallbackSig });
      expect(result).toBeNull();

      // Case B: a real key is configured — must reject (key mismatch).
      process.env.PROFILE_HEADER_HMAC_KEY = "real-production-key";
      result = await verifyProfileHeader({ ...profile, signature: fallbackSig });
      expect(result).toBeNull();
    });
  });

  describe("R-02: dedicated key separate from CRON_SECRET", () => {
    it("uses PROFILE_HEADER_HMAC_KEY when both keys are set", async () => {
      process.env.PROFILE_HEADER_HMAC_KEY = "profile-key";
      process.env.CRON_SECRET = "cron-key";

      const profile = { id: "p", role: "doctor", clinic_id: "c" };
      const sig = await signProfileHeader(profile);
      expect(sig).not.toBeNull();

      const verified = await verifyProfileHeader({ ...profile, signature: sig });
      expect(verified).toEqual(profile);
    });

    it("a signature made with CRON_SECRET does NOT verify when PROFILE_HEADER_HMAC_KEY is set", async () => {
      // Simulates a deployment that has rotated to a dedicated profile
      // key. Old signatures (or signatures forged using a leaked
      // CRON_SECRET) must be rejected.
      const profile = { id: "p", role: "clinic_admin", clinic_id: "c" };
      const cronSig = await signWithRawKey("cron-key", profile);

      process.env.PROFILE_HEADER_HMAC_KEY = "profile-key";
      process.env.CRON_SECRET = "cron-key";

      const verified = await verifyProfileHeader({ ...profile, signature: cronSig });
      expect(verified).toBeNull();
    });

    it("falls back to CRON_SECRET only when PROFILE_HEADER_HMAC_KEY is unset (transitional)", async () => {
      process.env.CRON_SECRET = "legacy-key";

      const profile = { id: "p", role: "receptionist", clinic_id: null };
      const sig = await signProfileHeader(profile);
      expect(sig).not.toBeNull();

      const verified = await verifyProfileHeader({ ...profile, signature: sig });
      expect(verified).toEqual(profile);
    });
  });

  describe("verification correctness", () => {
    beforeEach(() => {
      process.env.PROFILE_HEADER_HMAC_KEY = "test-key";
    });

    it("rejects when the role is tampered with", async () => {
      const sig = await signProfileHeader({
        id: "p",
        role: "patient",
        clinic_id: "c",
      });
      const verified = await verifyProfileHeader({
        id: "p",
        role: "super_admin", // attacker bumps role
        clinic_id: "c",
        signature: sig,
      });
      expect(verified).toBeNull();
    });

    it("rejects when the clinic_id is tampered with", async () => {
      const sig = await signProfileHeader({
        id: "p",
        role: "doctor",
        clinic_id: "clinic-a",
      });
      const verified = await verifyProfileHeader({
        id: "p",
        role: "doctor",
        clinic_id: "clinic-b", // cross-tenant attempt
        signature: sig,
      });
      expect(verified).toBeNull();
    });

    it("rejects when any required header is missing", async () => {
      const sig = await signProfileHeader({
        id: "p",
        role: "doctor",
        clinic_id: null,
      });

      expect(
        await verifyProfileHeader({ id: null, role: "doctor", clinic_id: null, signature: sig }),
      ).toBeNull();
      expect(
        await verifyProfileHeader({ id: "p", role: null, clinic_id: null, signature: sig }),
      ).toBeNull();
      expect(
        await verifyProfileHeader({ id: "p", role: "doctor", clinic_id: null, signature: null }),
      ).toBeNull();
    });
  });
});

/**
 * Sign a profile payload with an arbitrary raw key — used by the tests
 * to simulate forged headers without going through the helper's env
 * lookup logic.
 */
async function signWithRawKey(
  rawKey: string,
  profile: { id: string; role: string; clinic_id: string | null },
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rawKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = `${profile.id}:${profile.role}:${profile.clinic_id ?? ""}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
