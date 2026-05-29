/**
 * Mapper between Oltigo vitals records and FHIR Observation resources.
 *
 * Maps blood pressure, heart rate, temperature, and weight readings
 * to their corresponding LOINC-coded FHIR Observation resources.
 */

import type { FhirObservation } from "../types/resources";

/** LOINC codes for common vital signs. */
const LOINC = {
  BLOOD_PRESSURE: { code: "85354-9", display: "Blood pressure panel" },
  SYSTOLIC: { code: "8480-6", display: "Systolic blood pressure" },
  DIASTOLIC: { code: "8462-4", display: "Diastolic blood pressure" },
  HEART_RATE: { code: "8867-4", display: "Heart rate" },
  TEMPERATURE: { code: "8310-5", display: "Body temperature" },
  WEIGHT: { code: "29463-7", display: "Body weight" },
  OXYGEN_SAT: { code: "2708-6", display: "Oxygen saturation" },
} as const;

const LOINC_SYSTEM = "http://loinc.org";

/** Oltigo vitals row shape. */
export interface OltigoVitalsRow {
  id: string;
  patient_id: string;
  clinic_id: string;
  systolic?: number | null;
  diastolic?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  weight?: number | null;
  oxygen_saturation?: number | null;
  recorded_at: string;
  recorded_by?: string | null;
}

/**
 * Convert Oltigo vitals to an array of FHIR Observation resources.
 *
 * Each vital sign type becomes a separate Observation. Blood pressure
 * is modeled as a panel with systolic/diastolic components per FHIR spec.
 */
export function toFhirObservations(row: OltigoVitalsRow): FhirObservation[] {
  const observations: FhirObservation[] = [];
  const subjectRef = `Patient/${row.patient_id}`;

  if (row.systolic != null || row.diastolic != null) {
    const components: FhirObservation["component"] = [];
    if (row.systolic != null) {
      components.push({
        code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.SYSTOLIC }] },
        valueQuantity: { value: row.systolic, unit: "mmHg" },
      });
    }
    if (row.diastolic != null) {
      components.push({
        code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.DIASTOLIC }] },
        valueQuantity: { value: row.diastolic, unit: "mmHg" },
      });
    }
    observations.push({
      resourceType: "Observation",
      id: `${row.id}-bp`,
      status: "final",
      code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.BLOOD_PRESSURE }] },
      subject: { reference: subjectRef },
      effectiveDateTime: row.recorded_at,
      component: components,
    });
  }

  if (row.heart_rate != null) {
    observations.push({
      resourceType: "Observation",
      id: `${row.id}-hr`,
      status: "final",
      code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.HEART_RATE }] },
      subject: { reference: subjectRef },
      effectiveDateTime: row.recorded_at,
      valueQuantity: {
        value: row.heart_rate,
        unit: "/min",
        system: "http://unitsofmeasure.org",
        code: "/min",
      },
    });
  }

  if (row.temperature != null) {
    observations.push({
      resourceType: "Observation",
      id: `${row.id}-temp`,
      status: "final",
      code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.TEMPERATURE }] },
      subject: { reference: subjectRef },
      effectiveDateTime: row.recorded_at,
      valueQuantity: {
        value: row.temperature,
        unit: "°C",
        system: "http://unitsofmeasure.org",
        code: "Cel",
      },
    });
  }

  if (row.weight != null) {
    observations.push({
      resourceType: "Observation",
      id: `${row.id}-wt`,
      status: "final",
      code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.WEIGHT }] },
      subject: { reference: subjectRef },
      effectiveDateTime: row.recorded_at,
      valueQuantity: {
        value: row.weight,
        unit: "kg",
        system: "http://unitsofmeasure.org",
        code: "kg",
      },
    });
  }

  if (row.oxygen_saturation != null) {
    observations.push({
      resourceType: "Observation",
      id: `${row.id}-spo2`,
      status: "final",
      code: { coding: [{ system: LOINC_SYSTEM, ...LOINC.OXYGEN_SAT }] },
      subject: { reference: subjectRef },
      effectiveDateTime: row.recorded_at,
      valueQuantity: {
        value: row.oxygen_saturation,
        unit: "%",
        system: "http://unitsofmeasure.org",
        code: "%",
      },
    });
  }

  return observations;
}
