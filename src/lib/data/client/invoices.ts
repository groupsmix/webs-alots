"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// ─────────────────────────────────────────────
// Invoices / Payments
// ─────────────────────────────────────────────

export interface InvoiceView {
  id: string;
  patientName: string;
  appointmentId?: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  date: string;
}

interface PaymentRaw {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string;
  amount: number;
  method: string | null;
  status: string;
  reference: string | null;
  payment_type: string;
  gateway_session_id: string | null;
  refunded_amount: number;
  created_at: string;
}

export async function fetchInvoices(clinicId: string): Promise<InvoiceView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PaymentRaw>("payments", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    appointmentId: r.appointment_id ?? undefined,
    amount: r.amount,
    currency: "MAD",
    method: r.method ?? "cash",
    status: r.status === "completed" ? "paid" : r.status,
    date: r.created_at?.split("T")[0] ?? "",
  }));
}

