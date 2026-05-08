// eslint-disable-next-line import/order
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration tests for the billing/subscription API.
 *
 * Tests the billing cron job logic, plan limits, and renewal processing.
 */

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/assert-tenant", () => ({
  assertClinicId: vi.fn(),
}));

import {
  getPlanConfig,
  getPlanPrice,
  needsRenewal,
  calculateNextPeriod,
  type ClinicSubscription,
} from "@/lib/subscription-billing";

describe("Billing API — plan configuration", () => {
  it("free plan has zero cost", () => {
    const config = getPlanConfig("free");
    expect(config.priceMonthly).toBe(0);
    expect(config.priceYearly).toBe(0);
  });

  it("starter plan has correct monthly price", () => {
    expect(getPlanPrice("starter", "monthly")).toBe(199);
  });

  it("professional plan has correct yearly price", () => {
    expect(getPlanPrice("professional", "yearly")).toBe(5990);
  });

  it("enterprise plan includes API access", () => {
    const config = getPlanConfig("enterprise");
    expect(config.apiAccess).toBe(true);
    expect(config.videoConsultation).toBe(true);
  });
});

describe("Billing API — renewal logic", () => {
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

  it("identifies expired subscriptions needing renewal", () => {
    const expired = { ...baseSub, currentPeriodEnd: "2025-01-01" };
    expect(needsRenewal(expired)).toBe(true);
  });

  it("skips future subscriptions", () => {
    const future = { ...baseSub, currentPeriodEnd: "2099-12-31" };
    expect(needsRenewal(future)).toBe(false);
  });

  it("skips cancelled subscriptions", () => {
    const cancelled = { ...baseSub, status: "canceled" as const, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(cancelled)).toBe(false);
  });

  it("skips subscriptions with cancelAtPeriodEnd", () => {
    const ending = { ...baseSub, cancelAtPeriodEnd: true, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(ending)).toBe(false);
  });

  it("includes past_due subscriptions", () => {
    const pastDue = { ...baseSub, status: "past_due" as const, currentPeriodEnd: "2020-01-01" };
    expect(needsRenewal(pastDue)).toBe(true);
  });
});

describe("Billing API — period calculation", () => {
  it("advances monthly period correctly", () => {
    const result = calculateNextPeriod("2026-03-01", "monthly");
    expect(result.start).toBe("2026-03-01");
    expect(result.end).toBe("2026-04-01");
  });

  it("advances yearly period correctly", () => {
    const result = calculateNextPeriod("2026-03-01", "yearly");
    expect(result.start).toBe("2026-03-01");
    expect(result.end).toBe("2027-03-01");
  });

  it("handles month-end clamping for Feb", () => {
    const result = calculateNextPeriod("2026-01-31", "monthly");
    expect(result.end).toBe("2026-02-28");
  });

  it("handles year boundary (Dec → Jan)", () => {
    const result = calculateNextPeriod("2026-12-15", "monthly");
    expect(result.end).toBe("2027-01-15");
  });
});

describe("Billing API — cron authentication", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("billing cron requires valid CRON_SECRET", async () => {
    const { verifyCronSecret } = await import("@/lib/cron-auth");
    const mockReq = {
      headers: {
        get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer wrong" : null,
      },
    };
    process.env.CRON_SECRET = "correct-secret-at-least-32-chars!";
    const result = verifyCronSecret(mockReq as never);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("billing cron passes with correct secret", async () => {
    const { verifyCronSecret } = await import("@/lib/cron-auth");
    const mockReq = {
      headers: {
        get: (name: string) => name.toLowerCase() === "authorization" ? "Bearer correct-secret-at-least-32-chars!" : null,
      },
    };
    process.env.CRON_SECRET = "correct-secret-at-least-32-chars!";
    const result = verifyCronSecret(mockReq as never);
    expect(result).toBeNull();
  });
});
