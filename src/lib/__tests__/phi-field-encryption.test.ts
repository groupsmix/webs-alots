import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the crypto-utils module before importing
vi.mock("@/lib/crypto-utils", () => ({
  hexToBytes: vi.fn((hex: string) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

describe("PHI field encryption", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("PHI_ENCRYPTED_FIELDS contains expected sensitive fields", async () => {
    const mod = await import("@/lib/phi-field-encryption");
    expect(mod.PHI_ENCRYPTED_FIELDS).toContain("cin");
    expect(mod.PHI_ENCRYPTED_FIELDS).toContain("insurance_number");
    expect(mod.PHI_ENCRYPTED_FIELDS).toContain("emergency_contact_phone");
    expect(mod.PHI_ENCRYPTED_FIELDS).toContain("medical_notes");
    expect(mod.PHI_ENCRYPTED_FIELDS).toContain("allergy_details");
    expect(mod.PHI_ENCRYPTED_FIELDS).toContain("chronic_conditions");
  });

  it("encryptPhiFields skips null/undefined values", async () => {
    const mod = await import("@/lib/phi-field-encryption");
    const record = { cin: null, name: "Test", insurance_number: undefined };
    const result = await mod.encryptPhiFields(record as Record<string, unknown>);
    expect(result.cin).toBeNull();
    expect(result.insurance_number).toBeUndefined();
    expect(result.name).toBe("Test");
  });

  it("decryptPhiFields passes through non-encrypted values", async () => {
    const mod = await import("@/lib/phi-field-encryption");
    const record = { cin: "AB123456", name: "Test" };
    const result = await mod.decryptPhiFields(record as Record<string, unknown>);
    expect(result.cin).toBe("AB123456");
    expect(result.name).toBe("Test");
  });

  it("decryptPhiFields passes through null values", async () => {
    const mod = await import("@/lib/phi-field-encryption");
    const record = { cin: null, insurance_number: undefined };
    const result = await mod.decryptPhiFields(record as Record<string, unknown>);
    expect(result.cin).toBeNull();
    expect(result.insurance_number).toBeUndefined();
  });
});
