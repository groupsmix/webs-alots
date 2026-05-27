import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test encryption functions by setting PHI_ENCRYPTION_KEY in the env
// and calling encrypt/decrypt to verify the roundtrip.

describe("encryption", () => {
  const TEST_KEY_HEX = "a".repeat(64); // 256-bit key (all 0xAA bytes)

  beforeEach(() => {
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

    // Corrupt the ciphertext (flip a byte after the IV)
    const corrupted = Buffer.from(encrypted!);
    corrupted[15] = corrupted[15] ^ 0xFF;

    const decrypted = await decryptBuffer(corrupted);
    expect(decrypted).toBeNull();
  });

  it("returns null when encryption key is not configured", async () => {
    delete process.env.PHI_ENCRYPTION_KEY;
    // Re-import to get fresh module
    vi.resetModules();
    const { encryptBuffer } = await import("../encryption");

    const result = await encryptBuffer(Buffer.from("test"));
    expect(result).toBeNull();
  });

  it("returns null for data too short to contain IV", async () => {
    const { decryptBuffer } = await import("../encryption");

    const tooShort = Buffer.from([1, 2, 3]); // Less than 13 bytes
    const result = await decryptBuffer(tooShort);
    expect(result).toBeNull();
  });

  it("rejects invalid key length", async () => {
    process.env.PHI_ENCRYPTION_KEY = "short";
    vi.resetModules();
    const { encryptBuffer } = await import("../encryption");

    const result = await encryptBuffer(Buffer.from("test"));
    expect(result).toBeNull();
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
