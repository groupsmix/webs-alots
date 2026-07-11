"use client";

import { getLocalDateStr } from "@/lib/utils";
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

export async function fetchInvoices(
  clinicId: string,
  // PERF-LAT-05: optional ISO timestamp lower bound. Without it this query
  // ships the clinic's entire payment history to the browser. Callers that
  // only aggregate recent revenue should pass a sinceDate.
  options?: { sinceDate?: string },
): Promise<InvoiceView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PaymentRaw>("payments", {
    eq: [["clinic_id", clinicId]],
    ...(options?.sinceDate ? { gte: ["created_at", options.sinceDate] as [string, unknown] } : {}),
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
    date: r.created_at ? getLocalDateStr(new Date(r.created_at)) : "",
  }));
}
