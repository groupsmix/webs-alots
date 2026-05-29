import { describe, it, expect } from "vitest";
import type {
  FhirPatient,
  FhirObservation,
  FhirBundle,
  FhirOperationOutcome,
} from "@/modules/fhir/types/resources";

describe("FHIR type shapes", () => {
  it("FhirPatient can be constructed with minimal fields", () => {
    const patient: FhirPatient = {
      resourceType: "Patient",
      id: "test-1",
    };
    expect(patient.resourceType).toBe("Patient");
    expect(patient.id).toBe("test-1");
  });

  it("FhirPatient supports all optional fields", () => {
    const patient: FhirPatient = {
      resourceType: "Patient",
      id: "test-2",
      meta: { source: "oltigo-health" },
      identifier: [{ system: "urn:oltigo:insurance-type", value: "CNSS" }],
      name: [{ use: "official", family: "Alaoui", given: ["Mohammed"] }],
      telecom: [
        { system: "phone", value: "+212600000001", use: "mobile" },
        { system: "email", value: "test@example.com" },
      ],
      gender: "male",
      birthDate: "1985-03-15",
      address: [{ use: "home", line: ["123 Rue Hassan II"], city: "Casablanca", country: "MA" }],
    };
    expect(patient.name?.[0]?.family).toBe("Alaoui");
    expect(patient.gender).toBe("male");
    expect(patient.address?.[0]?.country).toBe("MA");
    expect(patient.telecom).toHaveLength(2);
  });

  it("FhirObservation supports value quantity", () => {
    const obs: FhirObservation = {
      resourceType: "Observation",
      id: "obs-1",
      status: "final",
      code: {
        coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }],
      },
      subject: { reference: "Patient/test-1" },
      effectiveDateTime: "2024-01-15T10:00:00Z",
      valueQuantity: {
        value: 72,
        unit: "beats/minute",
        system: "http://unitsofmeasure.org",
        code: "/min",
      },
    };
    expect(obs.resourceType).toBe("Observation");
    expect(obs.status).toBe("final");
    expect(obs.valueQuantity?.value).toBe(72);
  });

  it("FhirObservation supports components for blood pressure", () => {
    const obs: FhirObservation = {
      resourceType: "Observation",
      id: "obs-bp",
      status: "final",
      code: {
        coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure" }],
      },
      subject: { reference: "Patient/test-1" },
      effectiveDateTime: "2024-01-15T10:00:00Z",
      component: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic" }] },
          valueQuantity: { value: 120, unit: "mmHg" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic" }] },
          valueQuantity: { value: 80, unit: "mmHg" },
        },
      ],
    };
    expect(obs.component).toHaveLength(2);
    expect(obs.component?.[0]?.valueQuantity?.value).toBe(120);
    expect(obs.component?.[1]?.valueQuantity?.value).toBe(80);
  });

  it("FhirBundle searchset with entries", () => {
    const bundle: FhirBundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: { resourceType: "Patient", id: "p-001" },
          fullUrl: "Patient/p-001",
        },
      ],
    };
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("searchset");
    expect(bundle.total).toBe(1);
    expect(bundle.entry).toHaveLength(1);
  });

  it("FhirBundle empty searchset", () => {
    const bundle: FhirBundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: 0,
      entry: [],
    };
    expect(bundle.total).toBe(0);
    expect(bundle.entry).toHaveLength(0);
  });

  it("FhirOperationOutcome with error", () => {
    const outcome: FhirOperationOutcome = {
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }],
    };
    expect(outcome.resourceType).toBe("OperationOutcome");
    expect(outcome.issue).toHaveLength(1);
    expect(outcome.issue[0].severity).toBe("error");
    expect(outcome.issue[0].diagnostics).toBe("Patient not found");
  });

  it("FhirOperationOutcome with multiple issues", () => {
    const outcome: FhirOperationOutcome = {
      resourceType: "OperationOutcome",
      issue: [
        { severity: "error", code: "invalid", diagnostics: "Missing required field" },
        { severity: "warning", code: "informational", diagnostics: "Field deprecated" },
      ],
    };
    expect(outcome.issue).toHaveLength(2);
  });
});
