import { describe, it, expect } from "vitest";
import { pseudonymise, depseudonymise, createPseudonymMap } from "../ai/pseudonymise";

describe("pseudonymise", () => {
  /**
   * A88-1: Regression — no raw PHI survives in pseudonymised output.
   *
   * This is a mutation-guard: if someone refactors pseudonymise() and
   * accidentally returns the original value, this test catches it.
   */
  it("replaces all PHI fields so no raw value survives", () => {
    const input = {
      name: "Ahmed Benali",
      email: "ahmed@example.com",
      phone: "+212612345678",
      cin: "AB123456",
      address: "12 Rue Hassan II, Casablanca",
      insurance_number: "CNSS-987654",
      diagnosis: "routine checkup",
      notes: "Patient arrived on time",
    };

    const map = createPseudonymMap();
    const result = pseudonymise(input, map);

    // Every PHI field must differ from the original
    expect(result.name).not.toBe(input.name);
    expect(result.email).not.toBe(input.email);
    expect(result.phone).not.toBe(input.phone);
    expect(result.cin).not.toBe(input.cin);
    expect(result.address).not.toBe(input.address);
    expect(result.insurance_number).not.toBe(input.insurance_number);

    // Non-PHI fields pass through unchanged
    expect(result.notes).toBe(input.notes);

    // Ensure raw PHI values don't appear anywhere in the output
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Ahmed Benali");
    expect(serialized).not.toContain("ahmed@example.com");
    expect(serialized).not.toContain("+212612345678");
    expect(serialized).not.toContain("AB123456");
    expect(serialized).not.toContain("12 Rue Hassan II");
    expect(serialized).not.toContain("CNSS-987654");
  });

  it("pseudonymises nested PHI fields recursively", () => {
    const input = {
      patient: {
        name: "Fatima Zahrae",
        phone: "+212698765432",
        records: [{ cin: "CD789012" }],
      },
    };

    const map = createPseudonymMap();
    const result = pseudonymise(input, map);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("Fatima Zahrae");
    expect(serialized).not.toContain("+212698765432");
    expect(serialized).not.toContain("CD789012");
  });

  it("produces deterministic pseudonyms within the same map", () => {
    const map = createPseudonymMap();
    const input = { name: "Hassan Alami" };

    const r1 = pseudonymise(input, map);
    const r2 = pseudonymise(input, map);

    expect(r1.name).toBe(r2.name);
  });

  it("depseudonymise restores original values", () => {
    const map = createPseudonymMap();
    const input = { name: "Karim Tazi" };
    const pseudo = pseudonymise(input, map);

    const response = `The patient ${pseudo.name} should take medication.`;
    const restored = depseudonymise(response, map);

    expect(restored).toContain("Karim Tazi");
    expect(restored).not.toContain(pseudo.name as string);
  });
});
