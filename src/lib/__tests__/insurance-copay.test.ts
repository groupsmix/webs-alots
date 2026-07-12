import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateInsuranceCoPay } from "@/lib/billing/insurance-copay";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const originalEnv = { ...process.env };

describe("calculateInsuranceCoPay", () => {
  const base = { totalAmount: 1000, policyNumber: "123456789", clinicId: "clinic-1" };

  beforeEach(() => {
    process.env.INSURANCE_PROVIDER = "sandbox";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns CNOPS coverage (80%) and patient co-pay (20%)", async () => {
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "CNOPS" });
    expect(result.eligible).toBe(true);
    expect(result.coveragePercentage).toBe(80);
    expect(result.coPayPercentage).toBe(20);
    expect(result.insuranceCoveredAmount).toBe(800);
    expect(result.patientPayAmount).toBe(200);
  });

  it("returns CMIM coverage (80%) and patient co-pay (20%)", async () => {
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "CMIM" });
    expect(result.eligible).toBe(true);
    expect(result.coveragePercentage).toBe(80);
    expect(result.insuranceCoveredAmount).toBe(800);
    expect(result.patientPayAmount).toBe(200);
  });

  it("returns CNSS coverage (70%) and patient co-pay (30%)", async () => {
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "CNSS" });
    expect(result.eligible).toBe(true);
    expect(result.coveragePercentage).toBe(70);
    expect(result.patientPayAmount).toBe(300);
  });

  it("returns RAMED 100% coverage with zero patient pay", async () => {
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "RAMED" });
    expect(result.eligible).toBe(true);
    expect(result.coveragePercentage).toBe(100);
    expect(result.patientPayAmount).toBe(0);
    expect(result.insuranceCoveredAmount).toBe(1000);
  });

  it("returns private coverage (90%) and patient co-pay (10%)", async () => {
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "private" });
    expect(result.eligible).toBe(true);
    expect(result.coveragePercentage).toBe(90);
    expect(result.patientPayAmount).toBe(100);
  });

  it("treats 'none' as ineligible and makes patient pay full amount", async () => {
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "none" });
    expect(result.eligible).toBe(false);
    expect(result.coveragePercentage).toBe(0);
    expect(result.patientPayAmount).toBe(1000);
  });

  it("rejects invalid/short policy numbers and makes patient pay full", async () => {
    const result = await calculateInsuranceCoPay({
      ...base,
      policyNumber: "1234",
      insuranceType: "CNOPS",
    });
    expect(result.eligible).toBe(false);
    expect(result.patientPayAmount).toBe(1000);
  });

  it("rounds insurance and patient amounts to nearest MAD", async () => {
    const result = await calculateInsuranceCoPay({
      totalAmount: 123,
      policyNumber: "123456789",
      insuranceType: "CNOPS",
      clinicId: "clinic-1",
    });
    expect(result.insuranceCoveredAmount).toBe(98);
    expect(result.patientPayAmount).toBe(25);
  });

  it("falls back to patient-pays-full when eligibility check throws", async () => {
    process.env.INSURANCE_PROVIDER = "amo";
    const result = await calculateInsuranceCoPay({ ...base, insuranceType: "CNOPS" });
    expect(result.eligible).toBe(false);
    expect(result.patientPayAmount).toBe(1000);
    expect(result.message).toContain("vérification");
    expect(logger.warn).toHaveBeenCalled();
  });
});
