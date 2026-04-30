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
 *   C-02: The HMAC payload now includes an `iat` (issued-at) timestamp.
 *         Headers older than 300 seconds are rejected to prevent replay.
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
      iat: "x-auth-profile-iat",
    });
  });

  describe("R-01: no fallback key", () => {
    it("signProfileHeader returns null when no key is configured", async () => {
      const result = await signProfileHeader({
        id: "profile-1",
        role: "super_admin",
        clinic_id: null,
      });
      expect(result).toBeNull();
    });

    it("verifyProfileHeader rejects forged headers when no key is configured", async () => {
      const result = await verifyProfileHeader({
        id: "attacker-profile-id",
        role: "super_admin",
        clinic_id: "victim-clinic",
        signature: "a".repeat(64),
        iat: String(Math.floor(Date.now() / 1000)),
      });
      expect(result).toBeNull();
    });

    it("verifyProfileHeader rejects headers signed with the literal 'fallback_secret_key'", async () => {
      const profile = { id: "p", role: "super_admin", clinic_id: "c" };
      const iat = Math.floor(Date.now() / 1000);
      const fallbackSig = await signWithRawKey("fallback_secret_key", profile, iat);

      // Case A: no key configured — must reject.
      let result = await verifyProfileHeader({ ...profile, signature: fallbackSig, iat: String(iat) });
      expect(result).toBeNull();

      // Case B: a real key is configured — must reject (key mismatch).
      process.env.PROFILE_HEADER_HMAC_KEY = "real-production-key";
      result = await verifyProfileHeader({ ...profile, signature: fallbackSig, iat: String(iat) });
      expect(result).toBeNull();
    });
  });

  describe("R-02: dedicated key separate from CRON_SECRET", () => {
    it("uses PROFILE_HEADER_HMAC_KEY when both keys are set", async () => {
      process.env.PROFILE_HEADER_HMAC_KEY = "profile-key";
      process.env.CRON_SECRET = "cron-key";

      const profile = { id: "p", role: "doctor", clinic_id: "c" };
      const signed = await signProfileHeader(profile);
      expect(signed).not.toBeNull();

      const verified = await verifyProfileHeader({
        ...profile,
        signature: signed!.sig,
        iat: String(signed!.iat),
      });
      expect(verified).toEqual(profile);
    });

    it("a signature made with CRON_SECRET does NOT verify when PROFILE_HEADER_HMAC_KEY is set", async () => {
      const profile = { id: "p", role: "clinic_admin", clinic_id: "c" };
      const iat = Math.floor(Date.now() / 1000);
      const cronSig = await signWithRawKey("cron-key", profile, iat);

      process.env.PROFILE_HEADER_HMAC_KEY = "profile-key";
      process.env.CRON_SECRET = "cron-key";

      const verified = await verifyProfileHeader({ ...profile, signature: cronSig, iat: String(iat) });
      expect(verified).toBeNull();
    });

    it("S-05: does NOT fall back to CRON_SECRET when PROFILE_HEADER_HMAC_KEY is unset", async () => {
      delete process.env.PROFILE_HEADER_HMAC_KEY;
      process.env.CRON_SECRET = "legacy-key";

      const profile = { id: "p", role: "receptionist", clinic_id: null };
      const result = await signProfileHeader(profile);
      expect(result).toBeNull();
    });
  });

  describe("verification correctness", () => {
    beforeEach(() => {
      process.env.PROFILE_HEADER_HMAC_KEY = "test-key";
    });

    it("rejects when the role is tampered with", async () => {
      const signed = await signProfileHeader({
        id: "p",
        role: "patient",
        clinic_id: "c",
      });
      const verified = await verifyProfileHeader({
        id: "p",
        role: "super_admin", // attacker bumps role
        clinic_id: "c",
        signature: signed!.sig,
        iat: String(signed!.iat),
      });
      expect(verified).toBeNull();
    });

    it("rejects when the clinic_id is tampered with", async () => {
      const signed = await signProfileHeader({
        id: "p",
        role: "doctor",
        clinic_id: "clinic-a",
      });
      const verified = await verifyProfileHeader({
        id: "p",
        role: "doctor",
        clinic_id: "clinic-b", // cross-tenant attempt
        signature: signed!.sig,
        iat: String(signed!.iat),
      });
      expect(verified).toBeNull();
    });

    it("rejects when any required header is missing", async () => {
      const signed = await signProfileHeader({
        id: "p",
        role: "doctor",
        clinic_id: null,
      });

      expect(
        await verifyProfileHeader({ id: null, role: "doctor", clinic_id: null, signature: signed!.sig, iat: String(signed!.iat) }),
      ).toBeNull();
      expect(
        await verifyProfileHeader({ id: "p", role: null, clinic_id: null, signature: signed!.sig, iat: String(signed!.iat) }),
      ).toBeNull();
      expect(
        await verifyProfileHeader({ id: "p", role: "doctor", clinic_id: null, signature: null, iat: String(signed!.iat) }),
      ).toBeNull();
    });
  });

  describe("C-02: iat-based replay protection", () => {
    beforeEach(() => {
      process.env.PROFILE_HEADER_HMAC_KEY = "test-key";
    });

    it("signProfileHeader returns sig + iat", async () => {
      const result = await signProfileHeader({ id: "p", role: "doctor", clinic_id: "c" });
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("sig");
      expect(result).toHaveProperty("iat");
      expect(typeof result!.sig).toBe("string");
      expect(typeof result!.iat).toBe("number");
    });

    it("rejects headers with an expired iat (> 300s old)", async () => {
      const profile = { id: "p", role: "doctor", clinic_id: "c" };
      const expiredIat = Math.floor(Date.now() / 1000) - 400; // 400s ago
      const sig = await signWithRawKey("test-key", profile, expiredIat);

      const verified = await verifyProfileHeader({
        ...profile,
        signature: sig,
        iat: String(expiredIat),
      });
      expect(verified).toBeNull();
    });

    it("rejects headers with a future iat (> 300s ahead)", async () => {
      const profile = { id: "p", role: "doctor", clinic_id: "c" };
      const futureIat = Math.floor(Date.now() / 1000) + 400; // 400s in the future
      const sig = await signWithRawKey("test-key", profile, futureIat);

      const verified = await verifyProfileHeader({
        ...profile,
        signature: sig,
        iat: String(futureIat),
      });
      expect(verified).toBeNull();
    });

    it("accepts headers with a recent iat (within 300s)", async () => {
      const profile = { id: "p", role: "doctor", clinic_id: "c" };
      const signed = await signProfileHeader(profile);
      expect(signed).not.toBeNull();

      const verified = await verifyProfileHeader({
        ...profile,
        signature: signed!.sig,
        iat: String(signed!.iat),
      });
      expect(verified).toEqual(profile);
    });

    it("rejects when iat is missing", async () => {
      const profile = { id: "p", role: "doctor", clinic_id: "c" };
      const signed = await signProfileHeader(profile);

      const verified = await verifyProfileHeader({
        ...profile,
        signature: signed!.sig,
        iat: null, // missing
      });
      expect(verified).toBeNull();
    });
  });
});

/**
 * Sign a profile payload with an arbitrary raw key and explicit iat — used
 * by the tests to simulate forged/expired headers without going through
 * the helper's env lookup logic.
 */
async function signWithRawKey(
  rawKey: string,
  profile: { id: string; role: string; clinic_id: string | null },
  iat: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rawKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = `${profile.id}:${profile.role}:${profile.clinic_id ?? ""}:${iat}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
