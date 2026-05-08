/**
 * Bug Group 2: Cryptographic Operations
 * 
 * Bug Condition Exploration Test
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms bugs exist.
 * **DO NOT attempt to fix the test or the code when it fails.**
 * 
 * This test encodes the expected behavior after the fix is implemented.
 * When this test passes after implementing the fix, it confirms the bugs are resolved.
 * 
 * Covers:
 * - A6-10 (LOW): PHI key rotation script missing from repository
 * - A6-11 (LOW): TOTP recovery code reuse prevention
 * 
 * Bug Condition Functions:
 * ```
 * FUNCTION isBugCondition_MissingPHIRotationScript()
 *   OUTPUT: boolean
 *   
 *   RETURN NOT exists("scripts/rotate-phi-key.ts") OR
 *          NOT isExecutable("scripts/rotate-phi-key.ts") OR
 *          NOT hasRequiredFunctions(["decryptWithKey", "encryptWithKey", "importKey"])
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_TOTPRecoveryCodeReuse(code)
 *   INPUT: code of type string
 *   OUTPUT: boolean
 *   
 *   // First use
 *   result1 = verifyBackupCode(code)
 *   
 *   // Second use (should fail)
 *   result2 = verifyBackupCode(code)
 *   
 *   RETURN result1.success = true AND result2.success = true
 *   // Bug exists if same code can be used twice
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_TOTPRecoveryCodeNotHashed()
 *   OUTPUT: boolean
 *   
 *   codes = generateBackupCodes()
 *   storedCodes = getUserMetadata().mfa_backup_codes
 *   
 *   RETURN ANY code IN codes WHERE code IN storedCodes
 *   // Bug exists if plaintext codes are stored
 * END FUNCTION
 * ```
 * 
 * Expected Behavior Properties (from design 2.1, 2.2, 2.3):
 * - Property 2.1: PHI key rotation script SHALL exist and rotate keys without data loss
 * - Property 2.2: TOTP recovery codes SHALL be marked as consumed after use
 * - Property 2.3: TOTP recovery codes SHALL be hashed with SHA-256 before storage
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { generateBackupCodes, verifyBackupCode } from "@/lib/mfa";
import { createClient } from "@/lib/supabase-server";

// Mock Supabase client
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

// Mock audit log
vi.mock("@/lib/audit-log", () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Bug Group 2: Cryptographic Operations Exploration", () => {
  describe("Bug Condition 1: PHI Key Rotation Script Missing (A6-10)", () => {
    it("should have PHI key rotation script in scripts/ directory (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Check if the script exists
      const scriptPath = join(process.cwd(), "scripts", "rotate-phi-key.ts");
      
      // EXPECTED BEHAVIOR AFTER FIX: Script should exist
      expect(existsSync(scriptPath)).toBe(true);
    });

    it("should have executable PHI key rotation script with required functions (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const scriptPath = join(process.cwd(), "scripts", "rotate-phi-key.ts");
      
      // Read the script content
      const scriptContent = readFileSync(scriptPath, "utf-8");
      
      // EXPECTED BEHAVIOR AFTER FIX: Script should contain key rotation logic
      expect(scriptContent).toContain("decryptWithKey");
      expect(scriptContent).toContain("encryptWithKey");
      expect(scriptContent).toContain("importKey");
      expect(scriptContent).toContain("PHI_ENCRYPTION_KEY_OLD");
      expect(scriptContent).toContain("PHI_ENCRYPTION_KEY");
    });

    it("should have PHI key rotation script that handles R2 file listing (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const scriptPath = join(process.cwd(), "scripts", "rotate-phi-key.ts");
      const scriptContent = readFileSync(scriptPath, "utf-8");
      
      // EXPECTED BEHAVIOR AFTER FIX: Script should list R2 files
      expect(scriptContent).toContain("ListObjectsV2Command");
      expect(scriptContent).toContain("GetObjectCommand");
      expect(scriptContent).toContain("PutObjectCommand");
    });

    it("should have PHI key rotation script with dry-run mode (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const scriptPath = join(process.cwd(), "scripts", "rotate-phi-key.ts");
      const scriptContent = readFileSync(scriptPath, "utf-8");
      
      // EXPECTED BEHAVIOR AFTER FIX: Script should support dry-run for testing
      expect(scriptContent).toContain("--dry-run");
      expect(scriptContent).toContain("dryRun");
    });

    it("should have PHI key rotation script with error handling (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const scriptPath = join(process.cwd(), "scripts", "rotate-phi-key.ts");
      const scriptContent = readFileSync(scriptPath, "utf-8");
      
      // EXPECTED BEHAVIOR AFTER FIX: Script should handle errors gracefully
      expect(scriptContent).toContain("try");
      expect(scriptContent).toContain("catch");
      expect(scriptContent).toContain("failed");
    });

    it("should have PHI key rotation script with progress logging (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const scriptPath = join(process.cwd(), "scripts", "rotate-phi-key.ts");
      const scriptContent = readFileSync(scriptPath, "utf-8");
      
      // EXPECTED BEHAVIOR AFTER FIX: Script should log progress
      expect(scriptContent).toContain("console.log");
      expect(scriptContent).toContain("succeeded");
      expect(scriptContent).toContain("Summary");
    });
  });

  describe("Bug Condition 2: TOTP Recovery Code Reuse Prevention (A6-11)", () => {
    let mockSupabase: any;
    let mockUser: any;
    let generatedCodes: string[];

    beforeEach(() => {
      vi.clearAllMocks();

      // Create mock user with backup codes
      mockUser = {
        id: "user-123",
        email: "test@example.com",
        user_metadata: {
          mfa_backup_codes: [
            // Pre-hashed codes for testing
            "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // hash of "password"
            "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", // hash of "12345678"
          ],
          mfa_backup_codes_generated_at: new Date().toISOString(),
        },
      };

      // Mock Supabase client
      mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
          updateUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };

      (createClient as any).mockResolvedValue(mockSupabase);
    });

    it("should prevent TOTP recovery code reuse (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Use a backup code
      const testCode = "password"; // Will hash to the first stored hash
      
      // First use - should succeed
      const result1 = await verifyBackupCode(testCode);
      expect(result1.error).toBeNull();
      
      // Verify that updateUser was called to remove the used code
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: {
          mfa_backup_codes: [
            "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b", // Only second code remains
          ],
        },
      });
      
      // Update mock to reflect the removed code
      mockUser.user_metadata.mfa_backup_codes = [
        "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
      ];
      
      // Second use of same code - should fail
      const result2 = await verifyBackupCode(testCode);
      
      // EXPECTED BEHAVIOR AFTER FIX: Second use should fail
      expect(result2.error).not.toBeNull();
      expect(result2.error).toBe("mfa.invalidBackupCode");
    });

    it("should remove used backup code from storage (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const testCode = "password";
      
      await verifyBackupCode(testCode);
      
      // EXPECTED BEHAVIOR AFTER FIX: Used code should be removed
      const updateCall = mockSupabase.auth.updateUser.mock.calls[0][0];
      expect(updateCall.data.mfa_backup_codes).toHaveLength(1);
      expect(updateCall.data.mfa_backup_codes).not.toContain(
        "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
      );
    });

    it("should fail when no backup codes exist (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Mock user with no backup codes
      mockUser.user_metadata.mfa_backup_codes = [];
      
      const result = await verifyBackupCode("any-code");
      
      // EXPECTED BEHAVIOR AFTER FIX: Should return error
      expect(result.error).toBe("mfa.noBackupCodes");
    });

    it("should fail when backup code does not match any stored hash (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const invalidCode = "wrong-code";
      
      const result = await verifyBackupCode(invalidCode);
      
      // EXPECTED BEHAVIOR AFTER FIX: Should return error
      expect(result.error).toBe("mfa.invalidBackupCode");
    });
  });

  describe("Bug Condition 3: TOTP Recovery Codes Not Hashed (A6-11)", () => {
    let mockSupabase: any;
    let mockUser: any;

    beforeEach(() => {
      vi.clearAllMocks();

      mockUser = {
        id: "user-456",
        email: "test2@example.com",
        user_metadata: {},
      };

      mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
          updateUser: vi.fn().mockImplementation(async (updates) => {
            // Store the updates in mock user
            mockUser.user_metadata = {
              ...mockUser.user_metadata,
              ...updates.data,
            };
            return {
              data: { user: mockUser },
              error: null,
            };
          }),
        },
      };

      (createClient as any).mockResolvedValue(mockSupabase);
    });

    it("should hash backup codes with SHA-256 before storage (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const result = await generateBackupCodes();
      
      expect(result.error).toBeNull();
      expect(result.codes).not.toBeNull();
      expect(result.codes).toHaveLength(10);
      
      // Get the stored hashes
      const updateCall = mockSupabase.auth.updateUser.mock.calls[0][0];
      const storedHashes = updateCall.data.mfa_backup_codes;
      
      // EXPECTED BEHAVIOR AFTER FIX: Stored values should be hashes, not plaintext
      expect(storedHashes).toHaveLength(10);
      
      // Verify that stored values are NOT the plaintext codes
      for (const code of result.codes!) {
        const plaintextCode = code.replaceAll("-", "");
        expect(storedHashes).not.toContain(plaintextCode);
        expect(storedHashes).not.toContain(code);
      }
      
      // Verify that stored values are 64-character hex strings (SHA-256 output)
      for (const hash of storedHashes) {
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it("should generate 10 unique backup codes (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const result = await generateBackupCodes();
      
      expect(result.codes).toHaveLength(10);
      
      // EXPECTED BEHAVIOR AFTER FIX: All codes should be unique
      const uniqueCodes = new Set(result.codes);
      expect(uniqueCodes.size).toBe(10);
    });

    it("should format backup codes with hyphen separator (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const result = await generateBackupCodes();
      
      // EXPECTED BEHAVIOR AFTER FIX: Codes should be formatted as XXXX-XXXX
      for (const code of result.codes!) {
        expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
      }
    });

    it("should store backup code generation timestamp (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      await generateBackupCodes();
      
      const updateCall = mockSupabase.auth.updateUser.mock.calls[0][0];
      
      // EXPECTED BEHAVIOR AFTER FIX: Should store generation timestamp
      expect(updateCall.data.mfa_backup_codes_generated_at).toBeDefined();
      expect(typeof updateCall.data.mfa_backup_codes_generated_at).toBe("string");
      
      // Verify it's a valid ISO timestamp
      const timestamp = new Date(updateCall.data.mfa_backup_codes_generated_at);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    });

    it("should verify hashed backup code correctly (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Generate codes
      const generateResult = await generateBackupCodes();
      const plainCode = generateResult.codes![0];
      
      // Verify the code
      const verifyResult = await verifyBackupCode(plainCode);
      
      // EXPECTED BEHAVIOR AFTER FIX: Should verify successfully
      expect(verifyResult.error).toBeNull();
    });

    it("should handle backup code with or without hyphen (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Generate codes
      const generateResult = await generateBackupCodes();
      const codeWithHyphen = generateResult.codes![0]; // e.g., "ABCD-1234"
      const codeWithoutHyphen = codeWithHyphen.replaceAll("-", ""); // e.g., "ABCD1234"
      
      // Both formats should work
      const result1 = await verifyBackupCode(codeWithHyphen);
      expect(result1.error).toBeNull();
      
      // Generate new codes for second test
      await generateBackupCodes();
      const newCode = (await generateBackupCodes()).codes![0];
      
      const result2 = await verifyBackupCode(newCode.replaceAll("-", ""));
      expect(result2.error).toBeNull();
    });

    it("should handle case-insensitive backup code verification (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Generate codes
      const generateResult = await generateBackupCodes();
      const upperCode = generateResult.codes![0]; // e.g., "ABCD-1234"
      const lowerCode = upperCode.toLowerCase(); // e.g., "abcd-1234"
      
      // Lowercase version should also work (after normalization)
      const result = await verifyBackupCode(lowerCode);
      
      // EXPECTED BEHAVIOR AFTER FIX: Should verify successfully (case-insensitive)
      expect(result.error).toBeNull();
    });
  });
});
