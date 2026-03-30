"use client";

import { clearLookupCache, type ClientBookingConfig } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";
import { fetchTimeSlots } from "./clinical";
import { fetchServices } from "./services";

// Booking Slot Helpers (client-side via Supabase)
// ─────────────────────────────────────────────

/**
 * Generate time-slot strings for a given date and doctor
 * based on the doctor's configured time_slots for that day of week.
 */
export async function fetchGeneratedSlots(
  clinicId: string,
  date: string,
  doctorId: string,
  bookingConfig?: ClientBookingConfig,
): Promise<string[]> {
  const dayOfWeek = new Date(date).getDay();
  const slots = await fetchTimeSlots(clinicId, doctorId);
  const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek && s.isAvailable);

  const result: string[] = [];
  // Use tenant-specific config passed by the caller.
  // Falls back to sensible defaults if bookingConfig is not provided.
  const duration = bookingConfig?.slotDuration ?? 30;
  const buffer = bookingConfig?.bufferTime ?? 5;

  for (const config of daySlots) {
    const [startH, startM] = config.startTime.split(":").map(Number);
    const [endH, endM] = config.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let current = startMinutes;
    while (current + duration <= endMinutes) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      result.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      current += duration + buffer;
    }
  }

  return result.sort();
}

/**
 * Get existing appointment counts per time slot for a given date and doctor.
 */
export async function fetchSlotBookingCounts(
  clinicId: string,
  date: string,
  doctorId: string,
): Promise<Record<string, number>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("start_time, status")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date)
    .not("status", "in", '("cancelled","no_show")');

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const appt of data) {
    const time = (appt.start_time as string)?.slice(0, 5) ?? "";
    if (time) {
      counts[time] = (counts[time] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Get available (non-fully-booked) slots for a date and doctor.
 */
export async function fetchAvailableSlots(
  clinicId: string,
  date: string,
  doctorId: string,
  bookingConfig?: ClientBookingConfig,
): Promise<string[]> {
  const [allSlots, bookingCounts] = await Promise.all([
    fetchGeneratedSlots(clinicId, date, doctorId, bookingConfig),
    fetchSlotBookingCounts(clinicId, date, doctorId),
  ]);

  // Use tenant-specific config passed by the caller.
  // Falls back to a sensible default if bookingConfig is not provided.
  const maxPerSlot = bookingConfig?.maxPerSlot ?? 1;
  return allSlots.filter((slot) => (bookingCounts[slot] ?? 0) < maxPerSlot);
}

// ─────────────────────────────────────────────
// Waiting List Mutations
// ─────────────────────────────────────────────

export async function addToWaitingList(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  preferred_date: string;
  preferred_time?: string;
  service_id?: string;
}): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const supabase = createClient();
  const { data: entry, error } = await supabase
    .from("waiting_list")
    .insert({
      ...data,
      status: "waiting",
    })
    .select("id")
    .single();

  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: error.message };
  }
  clearLookupCache();
  return { success: true, entryId: entry?.id };
}

// ─────────────────────────────────────────────
// Appointment Creation
// ─────────────────────────────────────────────

export async function createAppointment(data: {
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id?: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  is_first_visit?: boolean;
  insurance_flag?: boolean;
  booking_source?: string;
  notes?: string;
  is_emergency?: boolean;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = createClient();
  const { data: appt, error } = await supabase.from("appointments")
    .insert({
      ...data,
      status: "confirmed",
    } as Database["public"]["Tables"]["appointments"]["Insert"])
    .select("id")
    .single();

  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: error.message };
  }
  clearLookupCache();
  return { success: true, id: appt?.id };
}

// ─────────────────────────────────────────────
// Dental: Treatment Types (from services with category)
// ─────────────────────────────────────────────

export interface DentalTreatmentTypeView {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  description: string;
}

export async function fetchDentalTreatmentTypes(clinicId: string): Promise<DentalTreatmentTypeView[]> {
  const services = await fetchServices(clinicId);
  return services
    .filter((s) => s.active && s.category)
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category ?? "General",
      durationMinutes: s.duration,
      price: s.price,
      currency: s.currency,
      description: s.description,
    }));
}

