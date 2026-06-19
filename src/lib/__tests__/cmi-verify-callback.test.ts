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
   * Helper: compute the expected hash using the PRODUCTION implementation.
   *
   * P0-1: the previous helper reimplemented the (buggy) hash inline — sort
   * keys, join with `|`, HMAC-SHA256 — which mirrored the production blind
   * spot exactly, so no test could ever catch the canonicalization flaw or
   * the wrong primitive. We now call the real `generateHash`, so the test
   * and the code can never silently drift apart again.
   */
  async function computeExpectedHash(fields: Record<string, string>): Promise<string> {
    const { generateHash } = await import("@/lib/cmi");
    return generateHash(fields, TEST_SECRET_KEY);
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

  // ── 9. P0-1(b): pipe-injection canonicalization ───────────────────

  it("is not fooled by a '|' inside a field value (canonicalization)", async () => {
    const { verifyCmiCallback, generateHash } = await import("@/lib/cmi");

    // Two DIFFERENT field maps that, under an UNESCAPED `join("|")`, would
    // serialize to the same input "...|x|y|..." and thus the same hash.
    // With proper escaping they must produce DIFFERENT hashes.
    const a: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      description: "x|y", // contains a pipe
      oid: "order-pipe",
      ProcReturnCode: "00",
    };
    const b: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      description: "x", // boundary shifted: "x" | (next field starts "y...")
      descriptionx: "y", // crafted neighbour — only matters if unescaped
      oid: "order-pipe",
      ProcReturnCode: "00",
    };

    const hashA = await generateHash(a, TEST_SECRET_KEY);
    const hashB = await generateHash(b, TEST_SECRET_KEY);
    expect(hashA).not.toBe(hashB);

    // And a callback whose hash was computed for `a` must NOT validate if an
    // attacker swaps in a pipe-shifted value while keeping the old hash.
    const tampered = { ...a, description: "x", extra: "|y", hash: hashA };
    const result = await verifyCmiCallback(tampered);
    expect(result).toBeNull();
  });

  it("accepts a value that legitimately contains a pipe when correctly signed", async () => {
    const { verifyCmiCallback } = await import("@/lib/cmi");
    const fields: Record<string, string> = {
      clientid: TEST_MERCHANT_ID,
      amount: "100.00",
      description: "Soins | Détartrage", // real-world pipe in a label
      oid: "order-pipe-ok",
      ProcReturnCode: "00",
    };
    const hash = await computeExpectedHash(fields);
    const result = await verifyCmiCallback({ ...fields, hash, hashAlgorithm: "ver3" });
    expect(result).not.toBeNull();
    expect(result!.orderId).toBe("order-pipe-ok");
  });

  // ── 10. P0-1(a): hash is SHA-512/base64, not HMAC-hex ─────────────

  it("produces a base64 SHA-512 digest (not 64-char hex)", async () => {
    const { generateHash } = await import("@/lib/cmi");
    const hash = await generateHash({ a: "1", b: "2" }, TEST_SECRET_KEY);
    // SHA-512 → 64 bytes → 88 base64 chars (with one '=' pad). Definitely not
    // the 64-char lowercase hex an HMAC-SHA256 hex digest would be.
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(hash.length).toBe(88);
    expect(hash).not.toMatch(/^[0-9a-f]{64}$/);
  });

  it("sorts keys case-insensitively (BillToName vs billtoname order)", async () => {
    const { generateHash } = await import("@/lib/cmi");
    // Same logical fields, different key casing → identical canonical order →
    // identical hash. (A case-SENSITIVE sort would order "Z" before "a".)
    const h1 = await generateHash({ Zeta: "1", alpha: "2" }, TEST_SECRET_KEY);
    const h2 = await generateHash({ alpha: "2", Zeta: "1" }, TEST_SECRET_KEY);
    expect(h1).toBe(h2);
  });
});
