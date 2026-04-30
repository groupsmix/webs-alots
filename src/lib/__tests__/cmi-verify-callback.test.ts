/**
 * A88: Mutation-resistance tests for verifyCmiCallback.
 *
 * The audit (A88) found that all 5 mutation candidates in verifyCmiCallback
 * survive because there were zero dedicated tests. This suite exercises:
 *
 *   1. Happy-path: valid callback with correct HMAC is accepted.
 *   2. Forged hash: a tampered hash is rejected (timing-safe comparison).
 *   3. Missing hash: callback without a hash field returns null.
 *   4. Missing CMI config: returns null when CMI_MERCHANT_ID / CMI_SECRET_KEY
 *      are not set.
 *   5. S-06 unknown-field injection: extra fields outside CMI_KNOWN_HASH_FIELDS
 *      do not alter the computed HMAC.
 *   6. hashAlgorithm / encoding exclusion: these fields are excluded from the
 *      hash reconstruction per CMI protocol.
 *   7. Case-insensitive hash field lookup (HASH vs hash).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need the real crypto-utils for HMAC generation but mock the env config.
const TEST_MERCHANT_ID = "test-merchant-123";
const TEST_SECRET_KEY = "test-secret-key-for-hmac-verification";

// Mock logger to avoid console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("verifyCmiCallback", () => {
  beforeEach(() => {
    vi.stubEnv("CMI_MERCHANT_ID", TEST_MERCHANT_ID);
    vi.stubEnv("CMI_SECRET_KEY", TEST_SECRET_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /**
   * Helper: compute the expected HMAC hash the same way generateHash does
   * internally (sort keys alphabetically, join values with |, HMAC-SHA256).
   */
  async function computeExpectedHash(
    fields: Record<string, string>,
  ): Promise<string> {
    const { hmacSha256Hex } = await import("@/lib/crypto-utils");
    const sortedKeys = Object.keys(fields).sort();
    const hashInput = sortedKeys.map((k) => fields[k]).join("|");
    return hmacSha256Hex(TEST_SECRET_KEY, hashInput);
  }

  /**
   * Build a minimal valid CMI callback parameter set.
   */
  async function buildValidParams(): Promise<Record<string, string>> {
    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      currency: "504",
      oid: "order-001",
      ProcReturnCode: "00",
      TransId: "txn-abc-123",
      AuthCode: "auth-456",
    };
    const hash = await computeExpectedHash(fields);
    return { ...fields, hash, encoding: "UTF-8", hashAlgorithm: "ver3" };
  }

  // ── 1. Happy path ──────────────────────────────────────────────────

  it("accepts a valid callback with correct HMAC", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");
    const params = await buildValidParams();

    const result = await verifyCmiCallback(params);

    expect(result).not.toBeNull();
    expect(result!.orderId).toBe("order-001");
    expect(result!.amount).toBe("100.00");
    expect(result!.status).toBe("approved");
    expect(result!.transactionId).toBe("txn-abc-123");
    expect(result!.authCode).toBe("auth-456");
    expect(result!.responseCode).toBe("00");
  });

  // ── 2. Forged hash ────────────────────────────────────────────────

  it("rejects a callback with a forged hash", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");
    const params = await buildValidParams();
    // Tamper with the hash
    params.hash = "0000000000000000000000000000000000000000000000000000000000000000";

    const result = await verifyCmiCallback(params);
    expect(result).toBeNull();
  });

  it("rejects a callback with a slightly altered hash (single char diff)", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");
    const params = await buildValidParams();
    // Flip the first character
    const original = params.hash;
    params.hash = (original[0] === "a" ? "b" : "a") + original.slice(1);

    const result = await verifyCmiCallback(params);
    expect(result).toBeNull();
  });

  // ── 3. Missing hash ───────────────────────────────────────────────

  it("returns null when hash field is missing", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");
    const params = await buildValidParams();
    delete params.hash;
    delete params.HASH;

    const result = await verifyCmiCallback(params);
    expect(result).toBeNull();
  });

  // ── 4. Missing config ─────────────────────────────────────────────

  it("returns null when CMI is not configured", async () => {
    vi.stubEnv("CMI_MERCHANT_ID", "");
    vi.stubEnv("CMI_SECRET_KEY", "");
    // Force re-import to pick up new env
    vi.resetModules();
    const { verifyCmiCallback } = await import("@/lib/cmi");

    const params = await buildValidParams();
    const result = await verifyCmiCallback(params);
    expect(result).toBeNull();
  });

  // ── 5. S-06: Unknown-field injection ──────────────────────────────

  it("ignores unknown fields that are not in CMI_KNOWN_HASH_FIELDS", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");

    // Build params and compute hash WITHOUT the injected field
    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      currency: "504",
      oid: "order-002",
      ProcReturnCode: "00",
    };
    const hash = await computeExpectedHash(fields);

    // Add an unknown field AFTER computing the hash — it must be ignored
    const params = {
      ...fields,
      hash,
      encoding: "UTF-8",
      hashAlgorithm: "ver3",
      malicious_injected_field: "evil-value",
    };

    const result = await verifyCmiCallback(params);
    expect(result).not.toBeNull();
    expect(result!.orderId).toBe("order-002");
  });

  it("includes rnd_* custom fields in hash computation", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");

    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "50.00",
      oid: "order-003",
      ProcReturnCode: "00",
      rnd_clinic_id: "clinic-uuid-123",
    };
    const hash = await computeExpectedHash(fields);
    const params = {
      ...fields,
      hash,
      encoding: "UTF-8",
      hashAlgorithm: "ver3",
    };

    const result = await verifyCmiCallback(params);
    expect(result).not.toBeNull();
    expect(result!.orderId).toBe("order-003");
  });

  // ── 6. hashAlgorithm / encoding exclusion ─────────────────────────

  it("excludes encoding and hashAlgorithm from hash computation", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");

    // Compute hash from fields WITHOUT encoding/hashAlgorithm
    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "200.00",
      oid: "order-004",
      ProcReturnCode: "00",
    };
    const hash = await computeExpectedHash(fields);

    // Include encoding and hashAlgorithm in params — they must NOT affect
    // hash verification
    const params = {
      ...fields,
      hash,
      encoding: "UTF-8",
      hashAlgorithm: "ver3",
    };

    const result = await verifyCmiCallback(params);
    expect(result).not.toBeNull();
  });

  // ── 7. Case-insensitive hash field lookup ─────────────────────────

  it("accepts HASH (uppercase) as the hash field name", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");

    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "300.00",
      oid: "order-005",
      ProcReturnCode: "00",
    };
    const hash = await computeExpectedHash(fields);

    // Use uppercase HASH key
    const params = {
      ...fields,
      HASH: hash,
      encoding: "UTF-8",
      hashAlgorithm: "ver3",
    };

    const result = await verifyCmiCallback(params);
    expect(result).not.toBeNull();
    expect(result!.orderId).toBe("order-005");
  });

  // ── 8. Status mapping ─────────────────────────────────────────────

  it("maps ProcReturnCode != '00' to 'declined' status", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");

    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      oid: "order-006",
      ProcReturnCode: "05",
    };
    const hash = await computeExpectedHash(fields);
    const params = { ...fields, hash, encoding: "UTF-8", hashAlgorithm: "ver3" };

    const result = await verifyCmiCallback(params);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("declined");
    expect(result!.responseCode).toBe("05");
  });

  it("maps empty ProcReturnCode to 'error' status", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");

    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      oid: "order-007",
    };
    const hash = await computeExpectedHash(fields);
    const params = { ...fields, hash, encoding: "UTF-8", hashAlgorithm: "ver3" };

    const result = await verifyCmiCallback(params);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("error");
  });
});
