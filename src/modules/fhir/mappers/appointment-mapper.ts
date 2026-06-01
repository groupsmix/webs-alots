import type { FhirAppointment } from "../types/resources";

export interface OltigoAppointmentRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  slot_start: string;
  slot_end: string;
  notes?: string | null;
  cancellation_reason?: string | null;
}

export function toFhirAppointment(row: OltigoAppointmentRow): FhirAppointment {
  // Map Oltigo status to FHIR status
  let fhirStatus: FhirAppointment["status"] = "booked";
  switch (row.status) {
    case "pending":
      fhirStatus = "pending";
      break;
    case "scheduled":
    case "confirmed":
      fhirStatus = "booked";
      break;
    case "checked_in":
    case "in_progress":
      fhirStatus = "arrived";
      break;
    case "completed":
      fhirStatus = "fulfilled";
      break;
    case "no_show":
      fhirStatus = "noshow";
      break;
    case "cancelled":
      fhirStatus = "cancelled";
      break;
  }

  return {
    resourceType: "Appointment",
    id: row.id,
    status: fhirStatus,
    start: row.slot_start,
    end: row.slot_end,
    participant: [
      {
        actor: { reference: `Patient/${row.patient_id}` },
        status: "accepted",
      },
      {
        actor: { reference: `Practitioner/${row.doctor_id}` },
        status: "accepted",
      },
    ],
    ...(row.notes || row.cancellation_reason
      ? { reasonCode: [{ text: row.cancellation_reason || row.notes || undefined }] }
      : {}),
  };
}
