import { describe, it, expect } from "vitest";
import { isDiagnosticRequest, NON_DIAGNOSTIC_POLICY } from "@/lib/ai/safety-guard";

describe("AI safety guard", () => {
  describe("isDiagnosticRequest", () => {
    it("blocks diagnosis requests in French", () => {
      expect(isDiagnosticRequest("Quel diagnostic pour ma toux ?")).toBe(true);
      expect(isDiagnosticRequest("ordonnance pour une infection")).toBe(true);
    });

    it("blocks diagnosis requests in English", () => {
      expect(isDiagnosticRequest("What disease do I have?")).toBe(true);
      expect(isDiagnosticRequest("prescribe me antibiotics")).toBe(true);
    });

    it("blocks diagnosis requests in Arabic/Darija", () => {
      expect(isDiagnosticRequest("شنو مرض ديالي")).toBe(true);
      expect(isDiagnosticRequest("دواء عندي لي الصداع")).toBe(true);
      expect(isDiagnosticRequest("علاج ديالي")).toBe(true);
    });

    it("allows internal tooling tasks", () => {
      expect(isDiagnosticRequest("site builder")).toBe(false);
      expect(isDiagnosticRequest("support triage")).toBe(false);
      expect(isDiagnosticRequest("faq")).toBe(false);
      expect(isDiagnosticRequest("summarize")).toBe(false);
      expect(isDiagnosticRequest("translate")).toBe(false);
    });

    it("allows operational clinic questions", () => {
      expect(isDiagnosticRequest("Quel est le chiffre d'affaires de la clinique ce mois ?")).toBe(
        false,
      );
      expect(isDiagnosticRequest("Lien de la page d'accueil")).toBe(false);
    });
  });

  it("NON_DIAGNOSTIC_POLICY contains the non-diagnostic guard", () => {
    expect(NON_DIAGNOSTIC_POLICY).toContain("must NOT provide medical diagnoses");
    expect(NON_DIAGNOSTIC_POLICY).toContain("qualified healthcare professional");
  });
});
