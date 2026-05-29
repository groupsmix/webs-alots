import { describe, it, expect } from "vitest";
import { FhirProxy, toFhirPatient, fromFhirPatient, toFhirObservations } from "@/modules/fhir";

describe("FHIR module barrel exports", () => {
  it("exports FhirProxy class", () => {
    expect(FhirProxy).toBeDefined();
    expect(typeof FhirProxy).toBe("function");
  });

  it("exports toFhirPatient mapper", () => {
    expect(toFhirPatient).toBeDefined();
    expect(typeof toFhirPatient).toBe("function");
  });

  it("exports fromFhirPatient mapper", () => {
    expect(fromFhirPatient).toBeDefined();
    expect(typeof fromFhirPatient).toBe("function");
  });

  it("exports toFhirObservations mapper", () => {
    expect(toFhirObservations).toBeDefined();
    expect(typeof toFhirObservations).toBe("function");
  });
});
