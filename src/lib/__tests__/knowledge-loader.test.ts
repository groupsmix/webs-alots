import { describe, it, expect } from "vitest";
import {
  lookupDrugByName,
  lookupDrugInteractions,
  lookupMedicalTerm,
  lookupTriageTaxonomy,
  getPackVersion,
} from "@/lib/ai/knowledge/loader";

describe("Clinical Knowledge Pack Loader (E4)", () => {
  it("returns pack version", () => {
    expect(getPackVersion()).toBe("1.0");
  });

  describe("Drug Interactions", () => {
    it("finds warfarin interactions by name", () => {
      const result = lookupDrugByName("Warfarin");
      expect(result.packVersion).toBe("1.0");
      expect(result.interactions.length).toBeGreaterThan(0);
      expect(
        result.interactions.every((ix) => ix.drugA === "Warfarin" || ix.drugB === "Warfarin"),
      ).toBe(true);
    });

    it("finds specific warfarin + paracetamol interaction pair", () => {
      const result = lookupDrugInteractions("Warfarin", "Paracetamol");
      expect(result.interactions.length).toBe(1);
      expect(result.interactions[0].severity).toBe("high");
      expect(result.interactions[0].mechanism).toContain("CYP2C9");
    });

    it("returns empty for unknown drug", () => {
      const result = lookupDrugByName("XylophoneEthanol");
      expect(result.interactions).toHaveLength(0);
    });

    it("fuzzy matches case-insensitively", () => {
      const result = lookupDrugByName("warfarin");
      expect(result.interactions.length).toBeGreaterThan(0);
    });

    it("finds critical severity interactions", () => {
      const result = lookupDrugInteractions("Warfarin", "Fluconazole");
      expect(result.interactions.length).toBe(1);
      expect(result.interactions[0].severity).toBe("critical");
    });
  });

  describe("Medical Terms", () => {
    it("finds term by French name", () => {
      const result = lookupMedicalTerm("fièvre");
      expect(result.terms.length).toBeGreaterThan(0);
      expect(result.terms[0].termEn).toBe("fever");
    });

    it("finds term by English name", () => {
      const result = lookupMedicalTerm("pain");
      expect(result.terms.length).toBeGreaterThan(0);
      expect(result.terms[0].termFr).toBe("douleur");
    });

    it("returns empty for unknown term", () => {
      const result = lookupMedicalTerm("zyxwvutsrq");
      expect(result.terms).toHaveLength(0);
    });
  });

  describe("Triage Taxonomy", () => {
    it("finds critical entries for chest pain", () => {
      const result = lookupTriageTaxonomy("douleur thoracique");
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].urgency).toBe("critical");
      expect(result.entries[0].category).toBe("cardiac");
    });

    it("finds low urgency for common cold", () => {
      const result = lookupTriageTaxonomy("rhume");
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].urgency).toBe("low");
    });

    it("returns empty for unknown symptom", () => {
      const result = lookupTriageTaxonomy("zyxwvutsrq");
      expect(result.entries).toHaveLength(0);
    });
  });
});
