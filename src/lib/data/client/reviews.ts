"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// ─────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────

export interface ReviewView {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  rating: number;
  comment: string;
  date: string;
  status: string;
  replied: boolean;
  response?: string;
}

interface ReviewRaw {
  id: string;
  patient_id: string;
  clinic_id: string;
  doctor_id: string | null;
  stars: number;
  comment: string | null;
  response: string | null;
  is_visible: boolean;
  created_at: string;
}

export async function fetchReviews(clinicId: string): Promise<ReviewView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<ReviewRaw>("reviews", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    doctorName: r.doctor_id ? (_activeUserMap?.get(r.doctor_id)?.name ?? "Doctor") : "General",
    rating: r.stars,
    comment: r.comment ?? "",
    date: r.created_at?.split("T")[0] ?? "",
    status: r.is_visible ? "published" : "pending",
    replied: !!r.response,
    response: r.response ?? undefined,
  }));
}

