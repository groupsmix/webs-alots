"use client";

import { fetchRows, ensureLookups, _activeUserMap, createClient } from "./_core";

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

// ─────────────────────────────────────────────
// Write: submit a patient review
// ─────────────────────────────────────────────

// notification_preferences (migration 00161) is not yet in the generated DB
// types. Cast through this minimal shape — matches src/lib/whatsapp.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

export async function createReview(data: {
  clinicId: string;
  patientId: string;
  doctorId: string;
  stars: number;
  comment: string;
}): Promise<{ id: string }> {
  const supabase = createClient();
  // nosemgrep: semgrep.tenant-scoping — clinic_id is set in the insert payload below (INSERT has no .eq() chain)
  const { data: row, error } = await supabase
    .from("reviews")
    .insert({
      clinic_id: data.clinicId,
      patient_id: data.patientId,
      doctor_id: data.doctorId || null,
      stars: data.stars,
      comment: data.comment || null,
      is_visible: false, // pending moderation by admin
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

// ─────────────────────────────────────────────
// Write: upsert notification preferences
// ─────────────────────────────────────────────

export async function upsertNotificationPreferences(data: {
  userId: string;
  clinicId: string;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  appointmentReminders: boolean;
  bookingConfirmations: boolean;
  paymentReceipts: boolean;
  prescriptionUpdates: boolean;
}): Promise<void> {
  const supabase = createClient();
  // nosemgrep: semgrep.tenant-scoping — clinic_id is set in the upsert payload below (UPSERT has no .eq() chain)
  const { error } = await (supabase as unknown as SupabaseUntyped)
    .from("notification_preferences")
    .upsert(
      {
        user_id: data.userId,
        clinic_id: data.clinicId,
        whatsapp_enabled: data.whatsappEnabled,
        in_app_enabled: data.inAppEnabled,
        appointment_reminders: data.appointmentReminders,
        booking_confirmations: data.bookingConfirmations,
        payment_receipts: data.paymentReceipts,
        prescription_updates: data.prescriptionUpdates,
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function fetchNotificationPreferences(userId: string): Promise<{
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  appointmentReminders: boolean;
  bookingConfirmations: boolean;
  paymentReceipts: boolean;
  prescriptionUpdates: boolean;
} | null> {
  const supabase = createClient();
  // nosemgrep: semgrep.tenant-scoping — notification_preferences is user-keyed (unique on user_id); RLS scopes rows to the authenticated user
  const { data, error } = await (supabase as unknown as SupabaseUntyped)
    .from("notification_preferences")
    .select(
      "whatsapp_enabled, in_app_enabled, appointment_reminders, booking_confirmations, payment_receipts, prescription_updates",
    )
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  const row = data as {
    whatsapp_enabled: boolean;
    in_app_enabled: boolean;
    appointment_reminders: boolean;
    booking_confirmations: boolean;
    payment_receipts: boolean;
    prescription_updates: boolean;
  };
  return {
    whatsappEnabled: row.whatsapp_enabled,
    inAppEnabled: row.in_app_enabled,
    appointmentReminders: row.appointment_reminders,
    bookingConfirmations: row.booking_confirmations,
    paymentReceipts: row.payment_receipts,
    prescriptionUpdates: row.prescription_updates,
  };
}
