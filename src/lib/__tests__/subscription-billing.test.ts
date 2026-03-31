import { describe, it, expect } from "vitest";
import {
  getPlanConfig,
  getPlanPrice,
  getYearlySavings,
  needsRenewal,
  calculateNextPeriod,
  SUBSCRIPTION_PLANS,
  type ClinicSubscription,
} from "../subscription-billing";

describe("SUBSCRIPTION_PLANS", () => {
  it("defines 4 plans", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(4);
  });

  it("includes free, starter, professional, enterprise", () => {
    const ids = SUBSCRIPTION_PLANS.map((p) => p.id);
    expect(ids).toEqual(["free", "starter", "professional", "enterprise"]);
  });

  it("free plan has zero cost", () => {
    const free = SUBSCRIPTION_PLANS.find((p) => p.id === "free")!;
    expect(free.priceMonthly).toBe(0);
    expect(free.priceYearly).toBe(0);
  });

  it("professional plan uses -1 for unlimited", () => {
    const pro = SUBSCRIPTION_PLANS.find((p) => p.id === "professional")!;
    expect(pro.maxDoctors).toBe(-1);
    expect(pro.maxPatients).toBe(-1);
    expect(pro.maxAppointmentsPerMonth).toBe(-1);
  });

  it("enterprise has API access", () => {
    const enterprise = SUBSCRIPTION_PLANS.find((p) => p.id === "enterprise")!;
    expect(enterprise.apiAccess).toBe(true);
  });

  it("all plans have MAD currency", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      expect(plan.currency).toBe("MAD");
    }
  });
});

describe("getPlanConfig", () => {
  it("returns the correct plan for a known id", () => {
    const config = getPlanConfig("starter");
    expect(config.id).toBe("starter");
    expect(config.name).toBe("Starter");
  });

  it("throws on unknown plan", () => {
    // TypeScript won't normally allow this, but testing runtime safety
    expect(() => getPlanConfig("nonexistent" as "free")).toThrow(
      /Unknown subscription plan: "nonexistent"/,
    );
  });

  it("returns enterprise plan correctly", () => {
    const config = getPlanConfig("enterprise");
    expect(config.apiAccess).toBe(true);
    expect(config.customDomain).toBe(true);
  });
});

describe("getPlanPrice", () => {
  it("returns monthly price for monthly interval", () => {
    expect(getPlanPrice("starter", "monthly")).toBe(199);
  });

  it("returns yearly price for yearly interval", () => {
    expect(getPlanPrice("starter", "yearly")).toBe(1990);
  });

  it("returns 0 for free plan monthly", () => {
    expect(getPlanPrice("free", "monthly")).toBe(0);
  });

  it("returns 0 for free plan yearly", () => {
    expect(getPlanPrice("free", "yearly")).toBe(0);
  });

  it("returns correct price for professional monthly", () => {
    expect(getPlanPrice("professional", "monthly")).toBe(599);
  });

  it("returns correct price for enterprise yearly", () => {
    expect(getPlanPrice("enterprise", "yearly")).toBe(9990);
  });
});

describe("getYearlySavings", () => {
  it("calculates savings for starter plan", () => {
    // 199 * 12 - 1990 = 2388 - 1990 = 398
    expect(getYearlySavings("starter")).toBe(398);
  });

  it("calculates savings for professional plan", () => {
    // 599 * 12 - 5990 = 7188 - 5990 = 1198
    expect(getYearlySavings("professional")).toBe(1198);
  });

  it("returns 0 for free plan", () => {
    expect(getYearlySavings("free")).toBe(0);
  });

  it("calculates savings for enterprise plan", () => {
    // 999 * 12 - 9990 = 11988 - 9990 = 1998
    expect(getYearlySavings("enterprise")).toBe(1998);
  });
});

describe("needsRenewal", () => {
  const baseSub: ClinicSubscription = {
    id: "sub-1",
    clinicId: "clinic-1",
    plan: "starter",
    status: "active",
    billingInterval: "monthly",
    currentPeriodStart: "2026-01-01",
    currentPeriodEnd: "2026-02-01",
    cancelAtPeriodEnd: false,
  };

  it("returns true when period has ended and status is active", () => {
    const sub = { ...baseSub, currentPeriodEnd: "2025-01-01" };
    expect(needsRenewal(sub)).toBe(true);
  });

  it("returns false when period has not ended", () => {
    const sub = { ...baseSub, currentPeriodEnd: "2099-12-31" };
    expect(needsRenewal(sub)).toBe(false);
  });

  it("returns false when status is canceled", () => {
    const sub = { ...baseSub, status: "canceled" as const, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(sub)).toBe(false);
  });

  it("returns false when status is trialing", () => {
    const sub = { ...baseSub, status: "trialing" as const, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(sub)).toBe(false);
  });

  it("returns false when cancelAtPeriodEnd is true", () => {
    const sub = { ...baseSub, cancelAtPeriodEnd: true, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(sub)).toBe(false);
  });

  it("returns true for past_due status when period ended", () => {
    const sub = { ...baseSub, status: "past_due" as const, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(sub)).toBe(true);
  });

  it("returns false for paused status", () => {
    const sub = { ...baseSub, status: "paused" as const, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(sub)).toBe(false);
  });
});

describe("calculateNextPeriod", () => {
  it("advances monthly from Jan 1 to Feb 1", () => {
    const result = calculateNextPeriod("2026-01-01", "monthly");
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-02-01");
  });

  it("advances yearly from Jan 1 to next year Jan 1", () => {
    const result = calculateNextPeriod("2026-01-01", "yearly");
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2027-01-01");
  });

  it("handles month-end clamping (Jan 31 → Feb 28)", () => {
    const result = calculateNextPeriod("2026-01-31", "monthly");
    expect(result.start).toBe("2026-01-31");
    expect(result.end).toBe("2026-02-28");
  });

  it("handles leap year (Jan 31 2028 → Feb 29)", () => {
    const result = calculateNextPeriod("2028-01-31", "monthly");
    expect(result.end).toBe("2028-02-29");
  });

  it("advances from Dec to Jan next year", () => {
    const result = calculateNextPeriod("2026-12-15", "monthly");
    expect(result.end).toBe("2027-01-15");
  });

  it("handles Feb 28 → Mar 28 monthly", () => {
    const result = calculateNextPeriod("2026-02-28", "monthly");
    expect(result.end).toBe("2026-03-28");
  });

  it("yearly preserves the same date", () => {
    const result = calculateNextPeriod("2026-06-15", "yearly");
    expect(result.end).toBe("2027-06-15");
  });
});
