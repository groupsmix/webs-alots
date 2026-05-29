import { describe, it, expect } from "vitest";
import { validateDose } from "../cdss/dose-validation";

describe("validateDose", () => {
  it("returns valid for unknown drug (no rules available)", () => {
    const result = validateDose("unknown-drug", 500, "oral");
    expect(result.valid).toBe(true);
    expect(result.message).toContain("Aucune règle");
  });

  it("validates paracétamol within normal range", () => {
    const result = validateDose("paracétamol", 500, "oral");
    expect(result.valid).toBe(true);
  });

  it("rejects paracétamol exceeding absolute max", () => {
    const result = validateDose("paracétamol", 5000, "oral");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("maximum absolu");
  });

  it("applies age adjustment for paracétamol (child < 12)", () => {
    const result = validateDose("paracétamol", 3000, "oral", undefined, 8);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("âge");
    expect(result.factors).toContain("age");
  });

  it("allows adult paracétamol dose for age >= 12", () => {
    const result = validateDose("paracétamol", 3000, "oral", undefined, 30);
    expect(result.valid).toBe(true);
  });

  it("BLOCKS gentamicine when weight is missing (safety rule)", () => {
    const result = validateDose("gentamicine", 300, "iv");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Poids requis");
    expect(result.factors).toContain("weight_missing");
  });

  it("validates gentamicine with weight", () => {
    const result = validateDose("gentamicine", 200, "iv", 70);
    expect(result.valid).toBe(true);
    expect(result.factors).toContain("weight");
  });

  it("rejects gentamicine exceeding weight-based max", () => {
    const result = validateDose("gentamicine", 600, "iv", 70);
    expect(result.valid).toBe(false);
    expect(result.suggestedRange).toBeDefined();
  });

  it("applies renal adjustment for metformine", () => {
    const result = validateDose("metformine", 1500, "oral", undefined, undefined, 40);
    expect(result.valid).toBe(false);
    expect(result.factors).toContain("renal");
  });

  it("contra-indicates metformine for severe renal impairment (eGFR < 30)", () => {
    const result = validateDose("metformine", 500, "oral", undefined, undefined, 20);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("contre-indiqué");
  });

  it("allows metformine with normal renal function", () => {
    const result = validateDose("metformine", 1500, "oral", undefined, undefined, 90);
    expect(result.valid).toBe(true);
  });

  it("applies renal adjustment for ciprofloxacine", () => {
    const result = validateDose("ciprofloxacine", 750, "oral", undefined, undefined, 25);
    expect(result.valid).toBe(false);
    expect(result.factors).toContain("renal");
  });

  it("validates amoxicilline with renal function", () => {
    const result = validateDose("amoxicilline", 500, "oral", undefined, undefined, 90);
    expect(result.valid).toBe(true);
  });

  it("applies renal + age adjustments for amoxicilline", () => {
    const result = validateDose("amoxicilline", 2000, "oral", undefined, 8, 25);
    expect(result.valid).toBe(false);
  });
});
