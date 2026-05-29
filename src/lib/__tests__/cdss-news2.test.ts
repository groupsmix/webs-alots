import { describe, it, expect } from "vitest";
import { calculateNEWS2 } from "../cdss/news2";
import type { NEWS2Input } from "../cdss/types";

const normalVitals: NEWS2Input = {
  respiratoryRate: 16,
  oxygenSaturation: 97,
  supplementalOxygen: false,
  temperature: 37.0,
  systolicBP: 120,
  heartRate: 75,
  consciousness: "alert",
};

describe("calculateNEWS2", () => {
  it("returns low risk for normal vitals", () => {
    const result = calculateNEWS2(normalVitals);
    expect(result.total).toBe(0);
    expect(result.risk).toBe("low");
    expect(result.escalation).toContain("routine");
  });

  it("scores supplemental oxygen as 2", () => {
    const result = calculateNEWS2({ ...normalVitals, supplementalOxygen: true });
    expect(result.components.supplementalOxygen).toBe(2);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it("scores high respiratory rate (>24) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, respiratoryRate: 30 });
    expect(result.components.respiratoryRate).toBe(3);
  });

  it("scores low respiratory rate (<=8) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, respiratoryRate: 7 });
    expect(result.components.respiratoryRate).toBe(3);
  });

  it("scores low oxygen saturation (<=91) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, oxygenSaturation: 90 });
    expect(result.components.oxygenSaturation).toBe(3);
  });

  it("scores very low temperature (<=35.0) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, temperature: 34.5 });
    expect(result.components.temperature).toBe(3);
  });

  it("scores high temperature (>39.0) as 2", () => {
    const result = calculateNEWS2({ ...normalVitals, temperature: 40.0 });
    expect(result.components.temperature).toBe(2);
  });

  it("scores very low systolic BP (<=90) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, systolicBP: 85 });
    expect(result.components.systolicBP).toBe(3);
  });

  it("scores very high systolic BP (>=220) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, systolicBP: 225 });
    expect(result.components.systolicBP).toBe(3);
  });

  it("scores low heart rate (<=40) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, heartRate: 35 });
    expect(result.components.heartRate).toBe(3);
  });

  it("scores high heart rate (>130) as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, heartRate: 140 });
    expect(result.components.heartRate).toBe(3);
  });

  it("scores non-alert consciousness as 3", () => {
    const result = calculateNEWS2({ ...normalVitals, consciousness: "voice" });
    expect(result.components.consciousness).toBe(3);
    expect(result.risk).toBe("medium");
  });

  it("returns high risk for total >= 7", () => {
    const result = calculateNEWS2({
      respiratoryRate: 30,
      oxygenSaturation: 88,
      supplementalOxygen: true,
      temperature: 34.0,
      systolicBP: 85,
      heartRate: 140,
      consciousness: "pain",
    });
    expect(result.total).toBeGreaterThanOrEqual(7);
    expect(result.risk).toBe("high");
    expect(result.escalation).toContain("réanimation");
  });

  it("returns medium risk when any single parameter scores 3", () => {
    const result = calculateNEWS2({
      ...normalVitals,
      consciousness: "unresponsive",
    });
    expect(result.components.consciousness).toBe(3);
    expect(result.risk).toBe("medium");
    expect(result.escalation).toContain("urgente");
  });

  it("returns medium risk for total 5-6", () => {
    const result = calculateNEWS2({
      ...normalVitals,
      respiratoryRate: 22,
      heartRate: 115,
      temperature: 39.5,
    });
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(["medium", "high"]).toContain(result.risk);
  });

  it("returns low-medium risk for total 1-4", () => {
    const result = calculateNEWS2({
      ...normalVitals,
      heartRate: 95,
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeLessThanOrEqual(4);
    expect(result.risk).toBe("low-medium");
    expect(result.escalation).toContain("surveillance");
  });

  it("includes all component scores in result", () => {
    const result = calculateNEWS2(normalVitals);
    expect(result.components).toHaveProperty("respiratoryRate");
    expect(result.components).toHaveProperty("oxygenSaturation");
    expect(result.components).toHaveProperty("supplementalOxygen");
    expect(result.components).toHaveProperty("temperature");
    expect(result.components).toHaveProperty("systolicBP");
    expect(result.components).toHaveProperty("heartRate");
    expect(result.components).toHaveProperty("consciousness");
  });

  it("scores oxygen saturation correctly with supplemental O2", () => {
    const result = calculateNEWS2({
      ...normalVitals,
      oxygenSaturation: 92,
      supplementalOxygen: true,
    });
    expect(result.components.oxygenSaturation).toBe(2);
  });

  it("scores mild tachycardia (91-110) as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, heartRate: 100 });
    expect(result.components.heartRate).toBe(1);
  });

  it("scores moderate tachycardia (111-130) as 2", () => {
    const result = calculateNEWS2({ ...normalVitals, heartRate: 120 });
    expect(result.components.heartRate).toBe(2);
  });

  it("scores mild hypotension (101-110) as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, systolicBP: 105 });
    expect(result.components.systolicBP).toBe(1);
  });

  it("scores moderate hypotension (91-100) as 2", () => {
    const result = calculateNEWS2({ ...normalVitals, systolicBP: 95 });
    expect(result.components.systolicBP).toBe(2);
  });

  it("scores mild fever (38.1-39.0) as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, temperature: 38.5 });
    expect(result.components.temperature).toBe(1);
  });

  it("scores mild hypothermia (35.1-36.0) as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, temperature: 35.5 });
    expect(result.components.temperature).toBe(1);
  });

  it("scores mild tachypnea (21-24) as 2", () => {
    const result = calculateNEWS2({ ...normalVitals, respiratoryRate: 23 });
    expect(result.components.respiratoryRate).toBe(2);
  });

  it("scores mild bradypnea (9-11) as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, respiratoryRate: 10 });
    expect(result.components.respiratoryRate).toBe(1);
  });

  it("scores SpO2 94-95 as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, oxygenSaturation: 94 });
    expect(result.components.oxygenSaturation).toBe(1);
  });

  it("scores SpO2 92-93 as 2", () => {
    const result = calculateNEWS2({ ...normalVitals, oxygenSaturation: 93 });
    expect(result.components.oxygenSaturation).toBe(2);
  });

  it("scores bradycardia (41-50) as 1", () => {
    const result = calculateNEWS2({ ...normalVitals, heartRate: 45 });
    expect(result.components.heartRate).toBe(1);
  });
});
