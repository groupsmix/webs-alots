"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// ─────────────────────────────────────────────
// Prescriptions
// ─────────────────────────────────────────────

export interface PrescriptionView {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  medications: { name: string; dosage: string; duration: string }[];
  notes?: string;
}

interface PrescriptionRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  items: { name: string; dosage: string; duration: string }[] | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
}

export async function fetchPrescriptions(clinicId: string, doctorId?: string): Promise<PrescriptionView[]> {
  await ensureLookups(clinicId);
  const eq: [string, unknown][] = [["clinic_id", clinicId]];
  if (doctorId) eq.push(["doctor_id", doctorId]);
  const rows = await fetchRows<PrescriptionRaw>("prescriptions", {
    eq,
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    date: r.created_at?.split("T")[0] ?? "",
    medications: r.items ?? [],
    notes: r.notes ?? undefined,
  }));
}

export async function fetchPatientPrescriptions(clinicId: string, patientId: string): Promise<PrescriptionView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PrescriptionRaw>("prescriptions", {
    eq: [["clinic_id", clinicId], ["patient_id", patientId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: _activeUserMap?.get(r.doctor_id)?.name ?? "Doctor",
    date: r.created_at?.split("T")[0] ?? "",
    medications: r.items ?? [],
    notes: r.notes ?? undefined,
  }));
}

