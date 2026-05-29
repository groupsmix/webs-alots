import { describe, it, expect } from "vitest";
import { toFhirObservations } from "@/modules/fhir/mappers/observation-mapper";
import {
  toFhirPatient,
  fromFhirPatient,
  type OltigoPatientRow,
} from "@/modules/fhir/mappers/patient-mapper";

describe("toFhirPatient", () => {
  const basePatient: OltigoPatientRow = {
    id: "p-001",
    full_name: "Mohammed Alaoui",
    email: "m.alaoui@example.com",
    phone: "+212600000001",
    clinic_id: "clinic-01",
    date_of_birth: "1985-03-15",
    gender: "male",
    address: "123 Rue Hassan II",
  };

  it("maps id and resourceType", () => {
    const fhir = toFhirPatient(basePatient);
    expect(fhir.resourceType).toBe("Patient");
    expect(fhir.id).toBe("p-001");
  });

  it("maps name to HumanName with family and given", () => {
    const fhir = toFhirPatient(basePatient);
    expect(fhir.name).toEqual([{ use: "official", family: "Alaoui", given: ["Mohammed"] }]);
  });

  it("maps email and phone to telecom", () => {
    const fhir = toFhirPatient(basePatient);
    expect(fhir.telecom).toEqual([
      { system: "phone", value: "+212600000001", use: "mobile" },
      { system: "email", value: "m.alaoui@example.com" },
    ]);
  });

  it("maps gender", () => {
    const fhir = toFhirPatient(basePatient);
    expect(fhir.gender).toBe("male");
  });

  it("maps birthDate", () => {
    const fhir = toFhirPatient(basePatient);
    expect(fhir.birthDate).toBe("1985-03-15");
  });

  it("maps address with country MA", () => {
    const fhir = toFhirPatient(basePatient);
    expect(fhir.address).toEqual([{ use: "home", line: ["123 Rue Hassan II"], country: "MA" }]);
  });

  it("handles missing optional fields gracefully", () => {
    const patient: OltigoPatientRow = {
      id: "p-002",
      full_name: "Fatima",
      clinic_id: "clinic-01",
    };
    const fhir = toFhirPatient(patient);
    expect(fhir.resourceType).toBe("Patient");
    expect(fhir.gender).toBeUndefined();
    expect(fhir.birthDate).toBeUndefined();
    expect(fhir.telecom).toBeUndefined();
    expect(fhir.address).toBeUndefined();
  });

  it("maps insurance_type to identifier", () => {
    const patient: OltigoPatientRow = {
      ...basePatient,
      insurance_type: "CNSS",
    };
    const fhir = toFhirPatient(patient);
    expect(fhir.identifier).toEqual([{ system: "urn:oltigo:insurance-type", value: "CNSS" }]);
  });

  it("sets unknown gender for unrecognised values", () => {
    const patient: OltigoPatientRow = { ...basePatient, gender: "autre" };
    const fhir = toFhirPatient(patient);
    expect(fhir.gender).toBe("unknown");
  });
});

describe("fromFhirPatient", () => {
  it("extracts full_name from FHIR Patient", () => {
    const fhir = {
      resourceType: "Patient" as const,
      id: "p-002",
      name: [{ family: "Benali", given: ["Fatima", "Zahra"] }],
      telecom: [
        { system: "phone" as const, value: "+212611111111" },
        { system: "email" as const, value: "f.benali@example.com" },
      ],
      gender: "female" as const,
      birthDate: "1990-07-20",
    };
    const result = fromFhirPatient(fhir);
    expect(result.full_name).toBe("Fatima Zahra Benali");
    expect(result.phone).toBe("+212611111111");
    expect(result.email).toBe("f.benali@example.com");
    expect(result.gender).toBe("female");
    expect(result.date_of_birth).toBe("1990-07-20");
  });

  it("handles missing fields", () => {
    const fhir = { resourceType: "Patient" as const, id: "p-003" };
    const result = fromFhirPatient(fhir);
    expect(result.full_name).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.email).toBeUndefined();
  });

  it("extracts address line", () => {
    const fhir = {
      resourceType: "Patient" as const,
      id: "p-004",
      address: [{ line: ["45 Bd Zerktouni"], city: "Casablanca" }],
    };
    const result = fromFhirPatient(fhir);
    expect(result.address).toBe("45 Bd Zerktouni");
  });
});

describe("toFhirObservations", () => {
  const baseVitals = {
    id: "v-001",
    patient_id: "p-001",
    clinic_id: "clinic-01",
    recorded_at: "2024-01-15T10:00:00Z",
    systolic: 120,
    diastolic: 80,
    heart_rate: 72,
    temperature: 36.8,
    weight: 75.5,
    oxygen_saturation: 98,
  };

  it("creates observations for each vital sign", () => {
    const observations = toFhirObservations(baseVitals);
    expect(observations.length).toBeGreaterThan(0);
    for (const obs of observations) {
      expect(obs.resourceType).toBe("Observation");
      expect(obs.status).toBe("final");
      expect(obs.subject?.reference).toBe("Patient/p-001");
    }
  });

  it("includes blood pressure observation with components", () => {
    const observations = toFhirObservations(baseVitals);
    const bp = observations.find((o) => o.code?.coding?.some((c) => c.code === "85354-9"));
    expect(bp).toBeDefined();
    expect(bp?.component).toBeDefined();
    expect(bp?.component?.length).toBe(2);
  });

  it("includes heart rate observation", () => {
    const observations = toFhirObservations(baseVitals);
    const hr = observations.find((o) => o.code?.coding?.some((c) => c.code === "8867-4"));
    expect(hr).toBeDefined();
    expect(hr?.valueQuantity?.value).toBe(72);
  });

  it("includes temperature observation", () => {
    const observations = toFhirObservations(baseVitals);
    const temp = observations.find((o) => o.code?.coding?.some((c) => c.code === "8310-5"));
    expect(temp).toBeDefined();
    expect(temp?.valueQuantity?.value).toBe(36.8);
  });

  it("includes weight observation", () => {
    const observations = toFhirObservations(baseVitals);
    const weight = observations.find((o) => o.code?.coding?.some((c) => c.code === "29463-7"));
    expect(weight).toBeDefined();
    expect(weight?.valueQuantity?.value).toBe(75.5);
  });

  it("includes oxygen saturation observation", () => {
    const observations = toFhirObservations(baseVitals);
    const spo2 = observations.find((o) => o.code?.coding?.some((c) => c.code === "2708-6"));
    expect(spo2).toBeDefined();
    expect(spo2?.valueQuantity?.value).toBe(98);
  });

  it("skips null vital signs", () => {
    const vitals = {
      ...baseVitals,
      heart_rate: null,
      weight: null,
      oxygen_saturation: null,
    };
    const observations = toFhirObservations(vitals);
    const hr = observations.find((o) => o.code?.coding?.some((c) => c.code === "8867-4"));
    expect(hr).toBeUndefined();
  });
});
