import { describe, it, expect } from "vitest";
import { suggestAlternatives, suggestAllAlternatives } from "../drug-alternatives";

describe("Drug Alternatives", () => {
  it("should suggest paracetamol for warfarin and aspirin", () => {
    const result = suggestAlternatives("acide acetylsalicylique", "warfarine");
    expect(result).not.toBeNull();
    expect(result?.alternatives).toBeDefined();
    expect(result?.alternatives.some((a) => a.drug === "paracétamol")).toBe(true);
  });

  it("should handle bidirectional lookup", () => {
    // Lookup order shouldn't matter
    const result1 = suggestAlternatives("ibuprofene", "warfarine");
    const result2 = suggestAlternatives("warfarine", "ibuprofene");

    // Result1 is suggesting alternatives for ibuprofen
    expect(result1?.alternatives.some((a) => a.drug === "paracétamol")).toBe(true);
    // Result2 is suggesting alternatives for warfarin (which we don't have explicit alternatives for, it maps to the same key, but the alternatives listed are meant for ibuprofen)
    // Actually, in the DB, alternatives for "ibuprofene|warfarine" are alternatives for the NSAID.
    expect(result2?.alternatives.some((a) => a.drug === "paracétamol")).toBe(true);
  });

  it("should return null for unknown interactions", () => {
    const result = suggestAlternatives("paracétamol", "vitamine c");
    expect(result).toBeNull();
  });

  it("should suggest all alternatives for multiple pairs", () => {
    const results = suggestAllAlternatives([
      { drugA: "ibuprofene", drugB: "warfarine" },
      { drugA: "clopidogrel", drugB: "omeprazole" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].alternatives.some((a) => a.drug === "paracétamol")).toBe(true);
    expect(results[1].alternatives.some((a) => a.drug === "pantoprazole")).toBe(true);
  });
});
