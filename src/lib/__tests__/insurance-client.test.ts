import { afterEach, describe, expect, it } from "vitest";
import { checkEligibility, submitClaim, type MoroccanInsuranceType } from "@/lib/insurance/client";

/**
 * Tests for the Moroccan insurance client (sandbox provider).
 *
 * Covers eligibility coverage rates, claim approval math, the crypto-grade
 * claim-number format (regression guard for the Math.random() -> randomUUID()
 * security fix), and the not-implemented guard for real providers.
 */
describe("insurance/client (sandbox)", () => {
  const ORIGINAL_PROVIDER = process.env.INSURANCE_PROVIDER;

  afterEach(() => {
    if (ORIGINAL_PROVIDER === undefined) {
      delete process.env.INSURANCE_PROVIDER;
    } else {
      process.env.INSURANCE_PROVIDER = ORIGINAL_PROVIDER;
    }
  });

  const claimBase = {
    policyNumber: "POL-12345",
    insuranceType: "AMO" as MoroccanInsuranceType,
    amountCentimes: 100_00,
    appointmentDate: "2026-06-30",
    doctorName: "Dr Test",
    patientName: "Patient Test",
  };

  describe("checkEligibility", () => {
    it("rejects a policy number shorter than 5 characters", async () => {
      const result = await checkEligibility("123", "AMO");
      expect(result.eligible).toBe(false);
      expect(result.coveragePercentage).toBe(0);
      expect(result.coPayPercentage).toBe(100);
    });

    it("returns the correct AMO coverage rates for a valid policy", async () => {
      const result = await checkEligibility("POL-12345", "AMO");
      expect(result.eligible).toBe(true);
      expect(result.coveragePercentage).toBe(70);
      expect(result.coPayPercentage).toBe(30);
      expect(result.policyNumber).toBe("POL-12345");
    });

    it("treats RAMED as fully covered with no annual limit", async () => {
      const result = await checkEligibility("RAMED-99999", "RAMED");
      expect(result.coveragePercentage).toBe(100);
      expect(result.coPayPercentage).toBe(0);
      expect(result.annualLimitCentimes).toBeUndefined();
    });

    it("applies an annual limit to non-RAMED insurance types", async () => {
      const result = await checkEligibility("POL-12345", "CNOPS");
      expect(result.coveragePercentage).toBe(80);
      expect(result.annualLimitCentimes).toBe(150_000_00);
    });
  });

  describe("submitClaim", () => {
    it("approves the coverage-adjusted amount and standard processing time", async () => {
      const result = await submitClaim(claimBase);
      expect(result.success).toBe(true);
      // floor(10000 * 70 / 100) = 7000
      expect(result.approvedAmountCentimes).toBe(7000);
      expect(result.processingDays).toBe(14);
    });

    it("processes RAMED claims faster and at full coverage", async () => {
      const result = await submitClaim({ ...claimBase, insuranceType: "RAMED" });
      expect(result.approvedAmountCentimes).toBe(10000);
      expect(result.processingDays).toBe(3);
    });

    it("generates a crypto-grade claim number with a 6-char uppercase hex suffix", async () => {
      const result = await submitClaim(claimBase);
      // Regression guard for the Math.random() -> crypto.randomUUID() fix.
      expect(result.claimNumber).toMatch(/^AMO-\d+-[0-9A-F]{6}$/);
    });

    it("produces unique claim numbers across many submissions", async () => {
      const numbers = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const result = await submitClaim(claimBase);
        if (result.claimNumber) numbers.add(result.claimNumber);
      }
      expect(numbers.size).toBe(50);
    });
  });

  describe("real provider integration (not yet implemented)", () => {
    it("checkEligibility throws for a non-sandbox provider", async () => {
      process.env.INSURANCE_PROVIDER = "amo";
      await expect(checkEligibility("POL-12345", "AMO")).rejects.toThrow(/not yet implemented/);
    });

    it("submitClaim throws for a non-sandbox provider", async () => {
      process.env.INSURANCE_PROVIDER = "cnops";
      await expect(submitClaim(claimBase)).rejects.toThrow(/not yet implemented/);
    });
  });
});
