import { describe, it, expect } from "vitest";
import {
  fhirSearchSchema,
  fhirImportPatientSchema,
  prescriptionTransitionSchema,
  prescriptionCreateSchema,
} from "@/lib/validations/fhir";

const UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("fhirSearchSchema", () => {
  it("accepts valid Patient search", () => {
    const result = fhirSearchSchema.safeParse({
      type: "Patient",
      name: "Mohammed",
    });
    expect(result.success).toBe(true);
  });

  it("accepts Observation search with patient", () => {
    const result = fhirSearchSchema.safeParse({
      type: "Observation",
      patient: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing type", () => {
    const result = fhirSearchSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = fhirSearchSchema.safeParse({ type: "InvalidType" });
    expect(result.success).toBe(false);
  });

  it("_count is optional", () => {
    const result = fhirSearchSchema.safeParse({ type: "Patient" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._count).toBeUndefined();
    }
  });

  it("coerces _count string to number", () => {
    const result = fhirSearchSchema.safeParse({ type: "Patient", _count: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._count).toBe(50);
    }
  });

  it("rejects _count above 200", () => {
    const result = fhirSearchSchema.safeParse({ type: "Patient", _count: 201 });
    expect(result.success).toBe(false);
  });
});

describe("fhirImportPatientSchema", () => {
  it("accepts valid FHIR Patient with name", () => {
    const result = fhirImportPatientSchema.safeParse({
      resourceType: "Patient",
      name: [{ family: "Alaoui", given: ["Mohammed"] }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts Patient without name (optional)", () => {
    const result = fhirImportPatientSchema.safeParse({
      resourceType: "Patient",
    });
    expect(result.success).toBe(true);
  });

  it("rejects wrong resourceType", () => {
    const result = fhirImportPatientSchema.safeParse({
      resourceType: "Observation",
    });
    expect(result.success).toBe(false);
  });

  it("accepts Patient with telecom", () => {
    const result = fhirImportPatientSchema.safeParse({
      resourceType: "Patient",
      telecom: [{ system: "phone", value: "+212600000001" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts Patient with gender and birthDate", () => {
    const result = fhirImportPatientSchema.safeParse({
      resourceType: "Patient",
      gender: "male",
      birthDate: "1985-03-15",
    });
    expect(result.success).toBe(true);
  });
});

describe("prescriptionTransitionSchema", () => {
  it("accepts valid transition", () => {
    const result = prescriptionTransitionSchema.safeParse({
      prescription_id: UUID,
      new_status: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("accepts transition with reason", () => {
    const result = prescriptionTransitionSchema.safeParse({
      prescription_id: UUID,
      new_status: "rejected",
      reason: "Posologie incorrecte",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing prescription_id", () => {
    const result = prescriptionTransitionSchema.safeParse({
      new_status: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing new_status", () => {
    const result = prescriptionTransitionSchema.safeParse({
      prescription_id: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status value", () => {
    const result = prescriptionTransitionSchema.safeParse({
      prescription_id: UUID,
      new_status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });
});

describe("prescriptionCreateSchema", () => {
  it("accepts valid prescription", () => {
    const result = prescriptionCreateSchema.safeParse({
      patient_id: UUID,
      medications: [
        {
          drug_name: "Amoxicilline",
          dosage: "500mg",
          frequency: "3x/jour",
          duration: "7 jours",
          quantity: 21,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty medications array", () => {
    const result = prescriptionCreateSchema.safeParse({
      patient_id: UUID,
      medications: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing patient_id", () => {
    const result = prescriptionCreateSchema.safeParse({
      medications: [
        {
          drug_name: "Paracétamol",
          dosage: "1g",
          frequency: "3x/jour",
          duration: "5 jours",
          quantity: 15,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects medication with quantity < 1", () => {
    const result = prescriptionCreateSchema.safeParse({
      patient_id: UUID,
      medications: [
        {
          drug_name: "Test",
          dosage: "1mg",
          frequency: "1x/jour",
          duration: "1 jour",
          quantity: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts prescription with optional fields", () => {
    const result = prescriptionCreateSchema.safeParse({
      patient_id: UUID,
      medications: [
        {
          drug_name: "Oméprazole",
          dosage: "20mg",
          frequency: "1x/jour",
          duration: "30 jours",
          quantity: 30,
          instructions: "Avant le repas",
          is_generic_allowed: true,
        },
      ],
      diagnosis: "Reflux gastro-œsophagien",
      notes: "Contrôle dans 1 mois",
    });
    expect(result.success).toBe(true);
  });
});
