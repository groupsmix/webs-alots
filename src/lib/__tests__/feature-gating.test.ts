import { describe, it, expect } from "vitest";
import { canAccessFeature, getMaxDoctors } from "../pricing-tiers";

describe("Pricing Tiers Feature Gating", () => {
  it("allows custom domains only on professional and enterprise", () => {
    expect(canAccessFeature("starter", "customDomain")).toBe(false);
    expect(canAccessFeature("professional", "customDomain")).toBe(true);
    expect(canAccessFeature("enterprise", "customDomain")).toBe(true);
  });

  it("restricts AI features on starter tier", () => {
    expect(canAccessFeature("starter", "aiFeatures")).toBe(false);
    expect(canAccessFeature("professional", "aiFeatures")).toBe(true);
    expect(canAccessFeature("enterprise", "aiFeatures")).toBe(true);
  });

  it("enforces doctor limits correctly", () => {
    expect(getMaxDoctors("starter")).toBe(1);
    expect(getMaxDoctors("professional")).toBe(5);
    expect(getMaxDoctors("enterprise")).toBe(999);
  });

  it("handles unknown or undefined tiers by defaulting to starter", () => {
    expect(canAccessFeature("", "aiFeatures")).toBe(false);
    expect(canAccessFeature("unknown_tier", "aiFeatures")).toBe(false);
    expect(getMaxDoctors("")).toBe(1);
  });
});
