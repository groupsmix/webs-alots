import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test encryption functions by setting PHI_ENCRYPTION_KEY in the env
// and calling encrypt/decrypt to verify the roundtrip.

describe("encryption", () => {
  const TEST_KEY_HEX = "a".repeat(64); // 256-bit key (all 0xAA bytes)

  beforeEach(() => {
    vi.resetModules();
    process.env.PHI_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    delete process.env.PHI_ENCRYPTION_KEY;
    vi.restoreAllMocks();
  });

  it("encrypts and decrypts a buffer roundtrip", async () => {
    const { encryptBuffer, decryptBuffer } = await import("../encryption");

    const original = Buffer.from("Patient prescription: Amoxicillin 500mg x 14 days");
    const encrypted = await encryptBuffer(original);

    expect(encrypted).not.toBeNull();
    expect(encrypted!.length).toBeGreaterThan(original.length); // IV + auth tag overhead

    // Encrypted content should differ from plaintext
    expect(encrypted!.toString("hex")).not.toBe(original.toString("hex"));

    const decrypted = await decryptBuffer(encrypted!);
    expect(decrypted).not.toBeNull();
    expect(decrypted!.toString()).toBe(original.toString());
  });

  it("produces different ciphertext for the same plaintext (unique IV)", async () => {
    const { encryptBuffer } = await import("../encryption");

    const original = Buffer.from("Same content twice");
    const encrypted1 = await encryptBuffer(original);
    const encrypted2 = await encryptBuffer(original);

    expect(encrypted1).not.toBeNull();
    expect(encrypted2).not.toBeNull();

    // Different IVs should produce different ciphertext
    expect(encrypted1!.toString("hex")).not.toBe(encrypted2!.toString("hex"));
  });

  it("fails decryption with corrupted data", async () => {
    const { encryptBuffer, decryptBuffer } = await import("../encryption");

    const original = Buffer.from("Sensitive health data");
    const encrypted = await encryptBuffer(original);
    expect(encrypted).not.toBeNull();

    // Corrupt the ciphertext (flip a byte after the version byte + IV)
    const corrupted = Buffer.from(encrypted!);
    corrupted[16] = corrupted[16] ^ 0xff;

    const decrypted = await decryptBuffer(corrupted);
    expect(decrypted).toBeNull();
  });

  it("throws when encryption key is not configured (BD-01)", async () => {
    delete process.env.PHI_ENCRYPTION_KEY;
    const { encryptBuffer } = await import("../encryption");

    await expect(encryptBuffer(Buffer.from("test"))).rejects.toThrow(
      "PHI_ENCRYPTION_KEY environment variable is required",
    );
  });

  it("returns null for data too short to contain IV", async () => {
    const { decryptBuffer } = await import("../encryption");

    const tooShort = Buffer.from([1, 2, 3]); // Less than 13 bytes
    const result = await decryptBuffer(tooShort);
    expect(result).toBeNull();
  });

  it("throws on invalid key length (CR-02)", async () => {
    process.env.PHI_ENCRYPTION_KEY = "short";
    const { encryptBuffer } = await import("../encryption");

    await expect(encryptBuffer(Buffer.from("test"))).rejects.toThrow(
      "PHI_ENCRYPTION_KEY must be exactly 64 hex characters",
    );
  });

  it("throws on non-hex key characters (CR-02)", async () => {
    process.env.PHI_ENCRYPTION_KEY = "g".repeat(64);
    const { encryptBuffer } = await import("../encryption");

    await expect(encryptBuffer(Buffer.from("test"))).rejects.toThrow(
      "PHI_ENCRYPTION_KEY must contain only hex characters",
    );
  });
});

describe("encryption - validateEncryptionKey (BD-01 / CR-01)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.PHI_ENCRYPTION_KEY;
    vi.restoreAllMocks();
  });

  it("throws when PHI_ENCRYPTION_KEY is missing", async () => {
    delete process.env.PHI_ENCRYPTION_KEY;
    const { validateEncryptionKey } = await import("../encryption");

    expect(() => validateEncryptionKey()).toThrow(
      "PHI_ENCRYPTION_KEY environment variable is required",
    );
  });

  it("throws when PHI_ENCRYPTION_KEY is wrong length", async () => {
    process.env.PHI_ENCRYPTION_KEY = "aabb";
    const { validateEncryptionKey } = await import("../encryption");

    expect(() => validateEncryptionKey()).toThrow("must be exactly 64 hex characters");
  });

  it("throws when PHI_ENCRYPTION_KEY contains non-hex characters", async () => {
    process.env.PHI_ENCRYPTION_KEY = "z".repeat(64);
    const { validateEncryptionKey } = await import("../encryption");

    expect(() => validateEncryptionKey()).toThrow("must contain only hex characters");
  });

  it("does not throw for a valid key", async () => {
    process.env.PHI_ENCRYPTION_KEY = "a".repeat(64);
    const { validateEncryptionKey } = await import("../encryption");

    expect(() => validateEncryptionKey()).not.toThrow();
  });
});

describe("encryption - requiresEncryption", () => {
  it("identifies PHI categories correctly", async () => {
    const { requiresEncryption } = await import("../encryption");

    // PHI categories that must be encrypted
    expect(requiresEncryption("documents")).toBe(true);
    expect(requiresEncryption("prescriptions")).toBe(true);
    expect(requiresEncryption("lab-results")).toBe(true);
    expect(requiresEncryption("lab_results")).toBe(true);
    expect(requiresEncryption("x-rays")).toBe(true);
    expect(requiresEncryption("medical-records")).toBe(true);
    expect(requiresEncryption("patient-files")).toBe(true);
  });

  // Audit Finding C-08: hyphen / underscore / case variants must all
  // resolve to the same encryption decision so a typo or stray
  // capitalization does not bypass PHI encryption.
  it("normalizes hyphens, underscores, and case for PHI categories", async () => {
    const { requiresEncryption } = await import("../encryption");

    expect(requiresEncryption("X-Rays")).toBe(true);
    expect(requiresEncryption("X_RAYS")).toBe(true);
    expect(requiresEncryption("xrays")).toBe(true); // legacy no-separator form
    expect(requiresEncryption("Lab-Results")).toBe(true);
    expect(requiresEncryption("PATIENT_FILES")).toBe(true);
    // Categories shared with LIMITS_BY_CATEGORY in upload route that were
    // historically missing from the PHI set:
    expect(requiresEncryption("lab_report")).toBe(true);
    expect(requiresEncryption("lab-report")).toBe(true);
    expect(requiresEncryption("radiology")).toBe(true);
  });

  it("does not encrypt non-PHI categories", async () => {
    const { requiresEncryption } = await import("../encryption");

    expect(requiresEncryption("logos")).toBe(false);
    expect(requiresEncryption("photos")).toBe(false);
    expect(requiresEncryption("uploads")).toBe(false);
    expect(requiresEncryption("branding")).toBe(false);
  });

  it("isEncryptionConfigured returns correct state", async () => {
    const { isEncryptionConfigured } = await import("../encryption");

    process.env.PHI_ENCRYPTION_KEY = "a".repeat(64);
    expect(isEncryptionConfigured()).toBe(true);

    delete process.env.PHI_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
  });
});

// SEC-013: Exercise the two-key rotation path end-to-end.
// Encrypt with OLD_KEY, rotate to NEW_KEY, verify decryptBuffer
// falls back to OLD_KEY for pre-rotation ciphertext.
describe("encryption - PHI key rotation (SEC-013)", () => {
  const OLD_KEY_HEX = "a".repeat(64);
  const NEW_KEY_HEX = "b".repeat(64);

  afterEach(() => {
    delete process.env.PHI_ENCRYPTION_KEY;
    delete process.env.PHI_ENCRYPTION_KEY_OLD;
    vi.restoreAllMocks();
  });

  it("decrypts old-key ciphertext after rotating to new key", async () => {
    // Step 1: Encrypt with the old key
    process.env.PHI_ENCRYPTION_KEY = OLD_KEY_HEX;
    vi.resetModules();
    const mod1 = await import("../encryption");
    const original = Buffer.from("Patient PHI: lab result CBC normal");
    const encrypted = await mod1.encryptBuffer(original);
    expect(encrypted).not.toBeNull();

    // Step 2: Rotate — new key is primary, old key is fallback
    process.env.PHI_ENCRYPTION_KEY = NEW_KEY_HEX;
    process.env.PHI_ENCRYPTION_KEY_OLD = OLD_KEY_HEX;
    vi.resetModules();
    const mod2 = await import("../encryption");

    // Decryption should succeed via the old key fallback
    const decrypted = await mod2.decryptBuffer(encrypted!);
    expect(decrypted).not.toBeNull();
    expect(decrypted!.toString()).toBe(original.toString());
  });

  it("encrypts with new key and decrypts without old key after rotation window", async () => {
    // Encrypt with the new key
    process.env.PHI_ENCRYPTION_KEY = NEW_KEY_HEX;
    vi.resetModules();
    const mod = await import("../encryption");
    const original = Buffer.from("New PHI data after rotation");
    const encrypted = await mod.encryptBuffer(original);
    expect(encrypted).not.toBeNull();

    // Old key removed (rotation window over) — still decrypts with current key
    delete process.env.PHI_ENCRYPTION_KEY_OLD;
    vi.resetModules();
    const mod2 = await import("../encryption");
    const decrypted = await mod2.decryptBuffer(encrypted!);
    expect(decrypted).not.toBeNull();
    expect(decrypted!.toString()).toBe(original.toString());
  });

  it("fails to decrypt when neither key matches", async () => {
    // Encrypt with a third key
    const THIRD_KEY = "c".repeat(64);
    process.env.PHI_ENCRYPTION_KEY = THIRD_KEY;
    vi.resetModules();
    const mod1 = await import("../encryption");
    const encrypted = await mod1.encryptBuffer(Buffer.from("data"));
    expect(encrypted).not.toBeNull();

    // Swap to unrelated keys
    process.env.PHI_ENCRYPTION_KEY = NEW_KEY_HEX;
    process.env.PHI_ENCRYPTION_KEY_OLD = OLD_KEY_HEX;
    vi.resetModules();
    const mod2 = await import("../encryption");
    const decrypted = await mod2.decryptBuffer(encrypted!);
    expect(decrypted).toBeNull();
  });
});

// CR-07: Version byte tests — new format prepends version byte,
// legacy format (no version byte) is still decryptable.
describe("encryption - version byte (CR-07)", () => {
  const TEST_KEY_HEX = "a".repeat(64);

  beforeEach(() => {
    vi.resetModules();
    process.env.PHI_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    delete process.env.PHI_ENCRYPTION_KEY;
    vi.restoreAllMocks();
  });

  it("new encryption prepends version byte 0x01", async () => {
    const { encryptBuffer } = await import("../encryption");

    const encrypted = await encryptBuffer(Buffer.from("test data"));
    // First byte should be version 1
    expect(encrypted[0]).toBe(1);
    // Total size: 1 (version) + 12 (IV) + plaintext + 16 (auth tag)
    expect(encrypted.length).toBe(1 + 12 + 9 + 16);
  });

  it("decrypts legacy format (no version byte) for backward compatibility", async () => {
    const { decryptBuffer } = await import("../encryption");
    const { hexToBytes } = await import("../crypto-utils");

    // Manually construct a legacy-format encrypted buffer:
    // [12-byte IV][ciphertext + GCM auth tag]
    const keyBytes = hexToBytes(TEST_KEY_HEX);
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode("legacy PHI data");
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

    // Legacy format: no version byte prefix
    const legacy = Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]);

    const decrypted = await decryptBuffer(legacy);
    expect(decrypted).not.toBeNull();
    expect(decrypted!.toString()).toBe("legacy PHI data");
  });
});

// EL-04 / FP-06: Decryption failure must trigger logger.error (which
// forwards to Sentry) so key misconfiguration generates alerts.
describe("encryption - decryption failure alerts (EL-04 / FP-06)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.PHI_ENCRYPTION_KEY;
    vi.restoreAllMocks();
  });

  it("calls logger.error with Sentry context when decryption fails", async () => {
    process.env.PHI_ENCRYPTION_KEY = "a".repeat(64);

    const loggerModule = await import("../logger");
    const errorSpy = vi.spyOn(loggerModule.logger, "error");

    const { decryptBuffer } = await import("../encryption");

    // Garbage data that won't decrypt
    const garbage = Buffer.alloc(30, 0x42);
    const result = await decryptBuffer(garbage);

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("AES-GCM decryption failed"),
      expect.objectContaining({
        context: "encryption",
        dataLength: 30,
      }),
    );
  });
});
