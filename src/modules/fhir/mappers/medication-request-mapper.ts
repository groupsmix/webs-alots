import type { FhirMedicationRequest } from "../types/resources";

export interface OltigoPrescriptionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  created_at: string;
  notes?: string | null;
  items?: Array<{
    name: string;
    dosage?: string;
    duration?: string;
    instructions?: string;
  }> | null;
}

export function toFhirMedicationRequests(row: OltigoPrescriptionRow): FhirMedicationRequest[] {
  if (!row.items || !Array.isArray(row.items)) {
    return [];
  }

  return row.items.map((item, index) => ({
    resourceType: "MedicationRequest",
    id: `${row.id}-${index}`,
    status: "active",
    intent: "order",
    medicationCodeableConcept: {
      text: item.name,
    },
    subject: { reference: `Patient/${row.patient_id}` },
    requester: { reference: `Practitioner/${row.doctor_id}` },
    authoredOn: row.created_at,
    dosageInstruction: [
      {
        text: [item.dosage, item.duration, item.instructions].filter(Boolean).join(" - "),
      },
    ],
  }));
}
