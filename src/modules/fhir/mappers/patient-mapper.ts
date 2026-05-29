/**
 * Bidirectional mapper between Oltigo patient records and FHIR Patient resources.
 *
 * Converts internal database rows to FHIR R4 format for EHR interoperability,
 * and maps incoming FHIR patients back to our schema.
 */

import type { FhirPatient } from "../types/resources";

/** Minimal Oltigo patient shape used by the mapper. */
export interface OltigoPatientRow {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  insurance_type?: string | null;
  clinic_id: string;
}

/**
 * Map an Oltigo patient row to a FHIR Patient resource.
 *
 * PHI is included in the output — the caller is responsible for
 * ensuring the request is authorised before sending this externally.
 */
export function toFhirPatient(row: OltigoPatientRow): FhirPatient {
  const nameParts = row.full_name.trim().split(/\s+/);
  const family = nameParts.pop() ?? "";
  const given = nameParts.length > 0 ? nameParts : undefined;

  const telecom: FhirPatient["telecom"] = [];
  if (row.phone) {
    telecom.push({ system: "phone", value: row.phone, use: "mobile" });
  }
  if (row.email) {
    telecom.push({ system: "email", value: row.email });
  }

  const patient: FhirPatient = {
    resourceType: "Patient",
    id: row.id,
    meta: { source: "oltigo-health" },
    name: [{ use: "official", family, given }],
    telecom: telecom.length > 0 ? telecom : undefined,
    birthDate: row.date_of_birth ?? undefined,
  };

  if (row.gender) {
    const g = row.gender.toLowerCase();
    if (g === "male" || g === "female" || g === "other") {
      patient.gender = g;
    } else {
      patient.gender = "unknown";
    }
  }

  if (row.address) {
    patient.address = [{ use: "home", line: [row.address], country: "MA" }];
  }

  if (row.insurance_type) {
    patient.identifier = [{ system: "urn:oltigo:insurance-type", value: row.insurance_type }];
  }

  return patient;
}

/**
 * Map a FHIR Patient resource to an Oltigo-compatible insert shape.
 *
 * Returns only the fields that are safe to upsert — clinic_id must
 * be supplied separately by the caller (never from the FHIR payload).
 */
export function fromFhirPatient(fhir: FhirPatient): Partial<OltigoPatientRow> {
  const result: Partial<OltigoPatientRow> = {};

  const officialName = fhir.name?.find((n) => n.use === "official") ?? fhir.name?.[0];
  if (officialName) {
    const parts = [...(officialName.given ?? []), officialName.family].filter(Boolean);
    if (parts.length > 0) {
      result.full_name = parts.join(" ");
    }
  }

  const phone = fhir.telecom?.find((t) => t.system === "phone");
  if (phone?.value) result.phone = phone.value;

  const email = fhir.telecom?.find((t) => t.system === "email");
  if (email?.value) result.email = email.value;

  if (fhir.birthDate) result.date_of_birth = fhir.birthDate;
  if (fhir.gender) result.gender = fhir.gender;

  const addr = fhir.address?.[0];
  if (addr?.line?.[0]) result.address = addr.line[0];

  const ins = fhir.identifier?.find((i) => i.system === "urn:oltigo:insurance-type");
  if (ins?.value) result.insurance_type = ins.value;

  return result;
}
