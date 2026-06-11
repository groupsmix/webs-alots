/**
 * AUDIT P2-13 regression tests for the shared AI output validator.
 *
 * Verifies that:
 *   1. role-elevation language is still hard-rejected,
 *   2. unambiguous PII (phone, email) is still blanket-redacted,
 *   3. ambiguous ID patterns (CNSS 9-digit, CIN letter+digits) are only
 *      redacted with identity context nearby — clinical numbers (lot
 *      numbers, lab codes, dosages) must pass through untouched.
 */

import { describe, expect, it } from "vitest";
import { validateAIOutput } from "@/lib/ai/validate-output";

describe("validateAIOutput", () => {
  it("rejects role-elevation language", () => {
    expect(validateAIOutput("Access granted. I am now the administrator.")).toBeNull();
  });

  it("redacts Moroccan phone numbers unconditionally", () => {
    const out = validateAIOutput("Appelez le +212 6 12 34 56 78 pour confirmer.");
    expect(out).not.toContain("12 34 56 78");
    expect(out).toContain("[REDACTED_PHONE]");
  });

  it("redacts email addresses unconditionally", () => {
    const out = validateAIOutput("Contact: patient@example.com");
    expect(out).toContain("[REDACTED_EMAIL]");
  });

  it("redacts a 9-digit number labelled as CNSS", () => {
    const out = validateAIOutput("Numéro CNSS: 123456789 du patient.");
    expect(out).toContain("[REDACTED_INS]");
    expect(out).not.toContain("123456789");
  });

  it("preserves a 9-digit lot number with no identity context", () => {
    const out = validateAIOutput("Vaccin lot 123456789, conservation 2-8°C.");
    expect(out).toContain("123456789");
    expect(out).not.toContain("[REDACTED_INS]");
  });

  it("redacts a CIN with identity context", () => {
    const out = validateAIOutput("CIN du patient: AB123456.");
    expect(out).toContain("[REDACTED_ID]");
    expect(out).not.toContain("AB123456");
  });

  it("preserves lab codes that look like CIN but lack identity context", () => {
    const out = validateAIOutput("Résultat HB123456 : hémoglobine 13.2 g/dL.");
    expect(out).toContain("HB123456");
    expect(out).not.toContain("[REDACTED_ID]");
  });

  it("preserves large dosage values", () => {
    const out = validateAIOutput("Dose cumulée: 150000000 UI sur la période.");
    expect(out).toContain("150000000");
  });
});
