import { describe, it, expect } from "vitest";
import {
  createPrescription,
  transitionPrescription,
  checkDrugInteractions,
  isValidTransition,
} from "@/modules/prescription";
import type { PrescriptionStatus, PrescriptionMedication } from "@/modules/prescription";

describe("Prescription module barrel exports", () => {
  it("exports createPrescription", () => {
    expect(createPrescription).toBeDefined();
    expect(typeof createPrescription).toBe("function");
  });

  it("exports transitionPrescription", () => {
    expect(transitionPrescription).toBeDefined();
    expect(typeof transitionPrescription).toBe("function");
  });

  it("exports checkDrugInteractions", () => {
    expect(checkDrugInteractions).toBeDefined();
    expect(typeof checkDrugInteractions).toBe("function");
  });

  it("exports isValidTransition", () => {
    expect(isValidTransition).toBeDefined();
    expect(typeof isValidTransition).toBe("function");
  });
});

describe("Prescription type shapes", () => {
  it("PrescriptionStatus type allows valid values", () => {
    const statuses: PrescriptionStatus[] = [
      "draft",
      "pending_review",
      "approved",
      "rejected",
      "dispensed",
      "completed",
      "cancelled",
    ];
    expect(statuses).toHaveLength(7);
  });

  it("PrescriptionMedication type has expected shape", () => {
    const med: PrescriptionMedication = {
      drug_name: "Amoxicilline",
      dosage: "500mg",
      frequency: "3x/jour",
      duration: "7 jours",
      quantity: 21,
    };
    expect(med.drug_name).toBe("Amoxicilline");
  });
});
