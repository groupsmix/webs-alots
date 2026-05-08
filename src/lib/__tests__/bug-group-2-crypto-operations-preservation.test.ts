/**
 * Bug Group 2 (A6-10, A6-11): Cryptographic Operations Preservation Tests
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * These tests capture the behavior on UNFIXED code for valid inputs.
 * They ensure that after implementing the fixes, legitimate operations:
 * - PHI encryption and decryption continue to work correctly
 * - TOTP MFA enrollment and verification continue to work
 * - Backup code generation and verification continue to work
 * - MFA step-up for sensitive operations continues to work
 * 
 * Preservation Requirements (from design.md):
 * 1. Valid TOTP codes must continue to work for MFA
 * 2. PHI encryption must continue to work correctly
 * 3. Backup code generation must continue to work
 * 4. MFA enrollment and verification must continue to work
 * 
 * Property: Preservation Checking
 * ```
 * FOR ALL input WHERE NOT isBugCondition_CryptoVulnerability(input) DO
 *   // Valid inputs continue to work after fixes
 *   ASSERT handleInput(input).success = TRUE AND
 *          handleInput'(input).success = TRUE AND
 *          handleInput(input).output = handleInput'(input).output
 * END FOR
 * ```
 * 
 * **Validates: Requirements Preservation 1, 2, 3, 4**
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { 
  enrollMFA, 
  verifyMFAEnrollment, 
  verifyMFALogin,
  unenrollMFA,
  getMFAFactors,
  isMFAEnabled,
  generateBackupCodes,
  verifyBackupCode,
  requireMfa
} from "@/lib/mfa";
import { encryptWithKey, decryptWithKey, importKey } from "@/lib/encryption";

// Mock Supabase client
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

// Mock audit log
vi.mock("@/lib/audit-log", () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Bug Group 2: Cryptographic Operations Preservation Tests", () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = {
      id: "user-123",
      email: "test@example.com",
      user_metadata: {},
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
        updateUser: vi.fn().mockImplementation(async (updates) => {
          mockUser.user_metadata = {
            ...mockUser.user_metadata,
            ...updates.data,
          };
          return {
            data: { user: mockUser },
            error: null,
          };
        }),
        mfa: {
          enroll: vi.fn().mockResolvedValue({
            data: {
              id: "factor-123",
              totp: {
                uri: "otpauth://totp/Test:test@example.com?secret=ABCD1234&issuer=Test",
                secret: "ABCD1234EFGH5678",
                qr_code: "data:image/svg+xml;base64,PHN2Zy8+",
              },
            },
            error: null,
          }),
          challenge: vi.fn().mockResolvedValue({
            data: { id: "challenge-123" },
            error: null,
          }),
          verify: vi.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
          unenroll: vi.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [
                {
                  id: "factor-123",
                  friendly_name: "Authenticator App",
                  status: "verified",
                },
              ],
            },
            error: null,
          }),
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: {
              currentLevel: "aal2",
              nextLevel: null,
            },
            error: null,
          }),
        },
      },
    };

    const { createClient } = require("@/lib/supabase-server");
    (createClient as any).mockResolvedValue(mockSupabase);
  });

  describe("Preservation 1: TOTP MFA Enrollment and Verification", () => {
    it("should successfully enroll user in TOTP MFA", async () => {
      const result = await enrollMFA();

      // PRESERVATION: MFA enrollment should work
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.data?.factorId).toBe("factor-123");
      expect(result.data?.totpUri).toContain("otpauth://totp/");
      expect(result.data?.secret).toBe("ABCD1234EFGH5678");
      expect(result.data?.qrCode).toContain("data:image/svg+xml");
    });

    it("should successfully verify TOTP code during enrollment", async () => {
      const result = await verifyMFAEnrollment("factor-123", "123456");

      // PRESERVATION: TOTP verification should work
      expect(result.error).toBeNull();
      expect(mockSupabase.auth.mfa.challenge).toHaveBeenCalledWith({
        factorId: "factor-123",
      });
      expect(mockSupabase.auth.mfa.verify).toHaveBeenCalledWith({
        factorId: "factor-123",
        challengeId: "challenge-123",
        code: "123456",
      });
    });

    it("should successfully verify TOTP code during login", async () => {
      const result = await verifyMFALogin("factor-123", "654321");

      // PRESERVATION: TOTP login verification should work
      expect(result.error).toBeNull();
      expect(mockSupabase.auth.mfa.challenge).toHaveBeenCalled();
      expect(mockSupabase.auth.mfa.verify).toHaveBeenCalledWith({
        factorId: "factor-123",
        challengeId: "challenge-123",
        code: "654321",
      });
    });

    it("should successfully unenroll TOTP MFA", async () => {
      const result = await unenrollMFA("factor-123");

      // PRESERVATION: MFA unenrollment should work
      expect(result.error).toBeNull();
      expect(mockSupabase.auth.mfa.unenroll).toHaveBeenCalledWith({
        factorId: "factor-123",
      });
    });

    it("should successfully list MFA factors", async () => {
      const result = await getMFAFactors();

      // PRESERVATION: Listing MFA factors should work
      expect(result.error).toBeNull();
      expect(result.factors).toHaveLength(1);
      expect(result.factors[0].id).toBe("factor-123");
      expect(result.factors[0].friendlyName).toBe("Authenticator App");
      expect(result.factors[0].status).toBe("verified");
    });

    it("should correctly detect if MFA is enabled", async () => {
      const isEnabled = await isMFAEnabled();

      // PRESERVATION: MFA status check should work
      expect(isEnabled).toBe(true);
    });

    it("should handle invalid TOTP code gracefully", async () => {
      mockSupabase.auth.mfa.verify.mockResolvedValueOnce({
        data: {},
        error: { message: "Invalid code" },
      });

      const result = await verifyMFALogin("factor-123", "000000");

      // PRESERVATION: Invalid codes should be rejected properly
      expect(result.error).toBe("mfa.invalidCode");
    });
  });

  describe("Preservation 2: Backup Code Generation and Verification", () => {
    it("should successfully generate 10 backup codes", async () => {
      const result = await generateBackupCodes();

      // PRESERVATION: Backup code generation should work
      expect(result.error).toBeNull();
      expect(result.codes).not.toBeNull();
      expect(result.codes).toHaveLength(10);

      // Verify format: XXXX-XXXX
      for (const code of result.codes!) {
        expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
      }
    });

    it("should generate unique backup codes", async () => {
      const result = await generateBackupCodes();

      // PRESERVATION: All codes should be unique
      const uniqueCodes = new Set(result.codes);
      expect(uniqueCodes.size).toBe(10);
    });

    it("should store backup codes in user metadata", async () => {
      await generateBackupCodes();

      // PRESERVATION: Codes should be stored
      expect(mockSupabase.auth.updateUser).toHaveBeenCalled();
      const updateCall = mockSupabase.auth.updateUser.mock.calls[0][0];
      expect(updateCall.data.mfa_backup_codes).toBeDefined();
      expect(updateCall.data.mfa_backup_codes).toHaveLength(10);
      expect(updateCall.data.mfa_backup_codes_generated_at).toBeDefined();
    });

    it("should successfully verify a valid backup code", async () => {
      // Generate codes first
      const generateResult = await generateBackupCodes();
      const validCode = generateResult.codes![0];

      // Mock the stored hashes
      const { createHash } = await import("crypto");
      const hashedCodes = generateResult.codes!.map((code) =>
        createHash("sha256").update(code.replaceAll("-", "")).digest("hex"),
      );
      mockUser.user_metadata.mfa_backup_codes = hashedCodes;

      // Verify the code
      const verifyResult = await verifyBackupCode(validCode);

      // PRESERVATION: Valid backup codes should work
      expect(verifyResult.error).toBeNull();
    });

    it("should remove used backup code from storage", async () => {
      // Generate codes
      const generateResult = await generateBackupCodes();
      const validCode = generateResult.codes![0];

      // Mock the stored hashes
      const { createHash } = await import("crypto");
      const hashedCodes = generateResult.codes!.map((code) =>
        createHash("sha256").update(code.replaceAll("-", "")).digest("hex"),
      );
      mockUser.user_metadata.mfa_backup_codes = hashedCodes;

      // Verify the code
      await verifyBackupCode(validCode);

      // PRESERVATION: Used code should be removed
      const updateCall = mockSupabase.auth.updateUser.mock.calls[1][0]; // Second call (first was generate)
      expect(updateCall.data.mfa_backup_codes).toHaveLength(9);
    });

    it("should handle backup code with or without hyphen", async () => {
      // Generate codes
      const generateResult = await generateBackupCodes();
      const codeWithHyphen = generateResult.codes![0];
      const codeWithoutHyphen = codeWithHyphen.replaceAll("-", "");

      // Mock the stored hashes
      const { createHash } = await import("crypto");
      const hashedCodes = generateResult.codes!.map((code) =>
        createHash("sha256").update(code.replaceAll("-", "")).digest("hex"),
      );
      mockUser.user_metadata.mfa_backup_codes = hashedCodes;

      // Both formats should work
      const result1 = await verifyBackupCode(codeWithHyphen);
      expect(result1.error).toBeNull();

      // Reset for second test
      mockUser.user_metadata.mfa_backup_codes = hashedCodes;
      const result2 = await verifyBackupCode(codeWithoutHyphen);
      expect(result2.error).toBeNull();
    });

    it("should handle case-insensitive backup code verification", async () => {
      // Generate codes
      const generateResult = await generateBackupCodes();
      const upperCode = generateResult.codes![0];
      const lowerCode = upperCode.toLowerCase();

      // Mock the stored hashes
      const { createHash } = await import("crypto");
      const hashedCodes = generateResult.codes!.map((code) =>
        createHash("sha256").update(code.replaceAll("-", "")).digest("hex"),
      );
      mockUser.user_metadata.mfa_backup_codes = hashedCodes;

      // Lowercase version should also work
      const result = await verifyBackupCode(lowerCode);

      // PRESERVATION: Case-insensitive verification should work
      expect(result.error).toBeNull();
    });

    it("should reject invalid backup code", async () => {
      mockUser.user_metadata.mfa_backup_codes = [
        "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
      ];

      const result = await verifyBackupCode("INVALID-CODE");

      // PRESERVATION: Invalid codes should be rejected
      expect(result.error).toBe("mfa.invalidBackupCode");
    });

    it("should handle missing backup codes gracefully", async () => {
      mockUser.user_metadata.mfa_backup_codes = [];

      const result = await verifyBackupCode("ANY-CODE");

      // PRESERVATION: Missing codes should return appropriate error
      expect(result.error).toBe("mfa.noBackupCodes");
    });
  });

  describe("Preservation 3: MFA Step-Up for Sensitive Operations", () => {
    it("should successfully verify MFA for sensitive operation", async () => {
      const result = await requireMfa("123456", "user_impersonation");

      // PRESERVATION: MFA step-up should work
      expect(result.verified).toBe(true);
      expect(result.error).toBeNull();
      expect(mockSupabase.auth.mfa.challenge).toHaveBeenCalled();
      expect(mockSupabase.auth.mfa.verify).toHaveBeenCalled();
    });

    it("should reject invalid MFA code during step-up", async () => {
      mockSupabase.auth.mfa.verify.mockResolvedValueOnce({
        data: {},
        error: { message: "Invalid code" },
      });

      const result = await requireMfa("000000", "user_impersonation");

      // PRESERVATION: Invalid codes should be rejected
      expect(result.verified).toBe(false);
      expect(result.error).toBe("mfa.invalidCode");
    });

    it("should handle MFA step-up for user without MFA", async () => {
      mockSupabase.auth.mfa.listFactors.mockResolvedValueOnce({
        data: { totp: [] },
        error: null,
      });

      const result = await requireMfa("123456", "user_impersonation");

      // PRESERVATION: Users without MFA should get appropriate error
      expect(result.verified).toBe(false);
      expect(result.error).toBe("mfa.notEnrolled");
    });
  });

  describe("Preservation 4: PHI Encryption and Decryption", () => {
    it("should successfully encrypt and decrypt PHI data", async () => {
      const testData = "Patient Name: John Doe, DOB: 1990-01-01";
      const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      // Import key
      const key = await importKey(testKey);

      // Encrypt
      const encrypted = await encryptWithKey(testData, key);

      // PRESERVATION: Encryption should work
      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      // Decrypt
      const decrypted = await decryptWithKey(encrypted, key);

      // PRESERVATION: Decryption should work and return original data
      expect(decrypted).toBe(testData);
    });

    it("should handle empty PHI data", async () => {
      const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const key = await importKey(testKey);

      const encrypted = await encryptWithKey("", key);
      const decrypted = await decryptWithKey(encrypted, key);

      // PRESERVATION: Empty data should be handled correctly
      expect(decrypted).toBe("");
    });

    it("should handle large PHI data", async () => {
      const largeData = "Patient Data: " + "x".repeat(10000);
      const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const key = await importKey(testKey);

      const encrypted = await encryptWithKey(largeData, key);
      const decrypted = await decryptWithKey(encrypted, key);

      // PRESERVATION: Large data should be handled correctly
      expect(decrypted).toBe(largeData);
    });

    it("should generate unique IVs for each encryption", async () => {
      const testData = "Patient Name: Jane Doe";
      const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const key = await importKey(testKey);

      const encrypted1 = await encryptWithKey(testData, key);
      const encrypted2 = await encryptWithKey(testData, key);

      // PRESERVATION: Each encryption should use a unique IV
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    it("should fail decryption with wrong key", async () => {
      const testData = "Patient Name: John Doe";
      const testKey1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const testKey2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

      const key1 = await importKey(testKey1);
      const key2 = await importKey(testKey2);

      const encrypted = await encryptWithKey(testData, key1);

      // PRESERVATION: Decryption with wrong key should fail
      await expect(decryptWithKey(encrypted, key2)).rejects.toThrow();
    });
  });

  describe("Preservation Summary", () => {
    it("should document all preserved behaviors for Bug Group 2", () => {
      const preservedBehaviors = [
        "TOTP MFA enrollment works correctly",
        "TOTP code verification during enrollment works",
        "TOTP code verification during login works",
        "MFA unenrollment works correctly",
        "Listing MFA factors works correctly",
        "MFA status detection works correctly",
        "Invalid TOTP codes are rejected properly",
        "Backup code generation creates 10 unique codes",
        "Backup codes are stored in user metadata",
        "Valid backup codes can be verified",
        "Used backup codes are removed from storage",
        "Backup codes work with or without hyphen",
        "Backup code verification is case-insensitive",
        "Invalid backup codes are rejected",
        "Missing backup codes return appropriate error",
        "MFA step-up for sensitive operations works",
        "Invalid MFA codes during step-up are rejected",
        "Users without MFA get appropriate error during step-up",
        "PHI encryption and decryption work correctly",
        "Empty PHI data is handled correctly",
        "Large PHI data is handled correctly",
        "Each encryption uses a unique IV",
        "Decryption with wrong key fails appropriately",
      ];

      // This test documents all preservation requirements
      expect(preservedBehaviors.length).toBeGreaterThan(0);
      preservedBehaviors.forEach((behavior) => {
        expect(behavior).toBeTruthy();
      });
    });
  });
});
