/**
 * Server-side data fetching for public-facing pages.
 *
 * These functions use the server Supabase client and scope all queries
 * to the current clinic via `clinicConfig.clinicId`.
 * They return data shaped to match the existing UI types so pages
 * can swap from demo-data imports with minimal changes.
 */

import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

// ── Types (match existing UI shapes) ──

export interface PublicBlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

export interface PublicReview {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  replied: boolean;
}

export interface PublicService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  currency: string;
  active: boolean;
}

export interface PublicDoctor {
  id: string;
  name: string;
  specialtyId: string;
  specialty: string;
  phone: string;
  email: string;
  avatar?: string;
  consultationFee: number;
  languages: string[];
}

export interface PublicSpecialty {
  id: string;
  name: string;
  description: string;
}

export interface ClinicBranding {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  heroImageUrl: string | null;
  clinicName: string;
}

// ── Helpers ──

function getClinicId(): string {
  return clinicConfig.clinicId;
}

// ── Clinic Branding ──

export async function getPublicBranding(): Promise<ClinicBranding> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("name, logo_url, favicon_url, primary_color, secondary_color, heading_font, body_font, hero_image_url")
    .eq("id", clinicId)
    .single();

  if (error || !data) {
    return {
      logoUrl: null,
      faviconUrl: null,
      primaryColor: "#1E4DA1",
      secondaryColor: "#0F6E56",
      headingFont: "Geist",
      bodyFont: "Geist",
      heroImageUrl: null,
      clinicName: clinicConfig.name,
    };
  }

  return {
    logoUrl: data.logo_url ?? null,
    faviconUrl: data.favicon_url ?? null,
    primaryColor: data.primary_color ?? "#1E4DA1",
    secondaryColor: data.secondary_color ?? "#0F6E56",
    headingFont: data.heading_font ?? "Geist",
    bodyFont: data.body_font ?? "Geist",
    heroImageUrl: data.hero_image_url ?? null,
    clinicName: data.name ?? clinicConfig.name,
  };
}

// ── Reviews ──

export async function getPublicReviews(): Promise<PublicReview[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  // Fetch reviews with patient names via join
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, patient_id, stars, comment, response, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error || !reviews || reviews.length === 0) return [];

  // Get patient names
  const patientIds = [...new Set(reviews.map((r) => r.patient_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", patientIds);

  const nameMap = new Map(
    (users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]),
  );

  return reviews.map((r) => ({
    id: r.id,
    patientName: nameMap.get(r.patient_id) ?? "Patient",
    rating: r.stars,
    comment: r.comment ?? "",
    date: r.created_at?.split("T")[0] ?? "",
    replied: !!r.response,
  }));
}

export async function getPublicAverageRating(): Promise<number> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select("stars")
    .eq("clinic_id", clinicId);

  if (!data || data.length === 0) return 0;
  const sum = data.reduce((s, r) => s + r.stars, 0);
  return Math.round((sum / data.length) * 10) / 10;
}

// ── Services ──

export async function getPublicServices(): Promise<PublicService[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_min, price, is_active")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: (s as Record<string, unknown>).description as string ?? "",
    duration: (s as Record<string, unknown>).duration_min as number ?? 30,
    price: s.price ?? 0,
    currency: clinicConfig.currency,
    active: (s as Record<string, unknown>).is_active as boolean ?? true,
  }));
}

// ── Doctors ──

export async function getPublicDoctors(): Promise<PublicDoctor[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, name, phone, email, avatar_url, metadata")
    .eq("clinic_id", clinicId)
    .eq("role", "doctor")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((d) => {
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    return {
      id: d.id,
      name: d.name,
      specialtyId: (meta.specialty_id as string) ?? "",
      specialty: (meta.specialty as string) ?? "",
      phone: d.phone ?? "",
      email: d.email ?? "",
      avatar: d.avatar_url ?? undefined,
      consultationFee: (meta.consultation_fee as number) ?? 0,
      languages: (meta.languages as string[]) ?? [],
    };
  });
}

// ── Specialties (derived from doctors) ──

export async function getPublicSpecialties(): Promise<PublicSpecialty[]> {
  const doctors = await getPublicDoctors();
  const seen = new Map<string, PublicSpecialty>();

  for (const d of doctors) {
    if (d.specialtyId && !seen.has(d.specialtyId)) {
      seen.set(d.specialtyId, {
        id: d.specialtyId,
        name: d.specialty,
        description: `${d.specialty} consultations`,
      });
    }
  }

  return Array.from(seen.values());
}

// ── Time Slots & Availability ──

export interface TimeSlotConfig {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bufferMinutes: number;
  isAvailable: boolean;
}

export async function getPublicTimeSlots(
  doctorId?: string,
): Promise<TimeSlotConfig[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  let q = supabase
    .from("time_slots")
    .select("id, doctor_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes")
    .eq("clinic_id", clinicId)
    .eq("is_available", true);

  if (doctorId) {
    q = q.eq("doctor_id", doctorId);
  }

  const { data, error } = await q.order("day_of_week", { ascending: true });

  if (error || !data) return [];

  return data.map((ts) => ({
    id: ts.id,
    doctorId: ts.doctor_id,
    dayOfWeek: ts.day_of_week,
    startTime: ts.start_time,
    endTime: ts.end_time,
    maxCapacity: ts.max_capacity ?? 1,
    bufferMinutes: ts.buffer_minutes ?? 10,
    isAvailable: ts.is_available ?? true,
  }));
}

/**
 * Generate individual time-slot strings for a given date and doctor,
 * based on the doctor's configured time_slots for that day of week.
 */
export async function getPublicGeneratedSlots(
  date: string,
  doctorId: string,
): Promise<string[]> {
  const dayOfWeek = new Date(date).getDay();
  const slotConfigs = await getPublicTimeSlots(doctorId);
  const daySlots = slotConfigs.filter((s) => s.dayOfWeek === dayOfWeek);

  const slots: string[] = [];
  const duration = clinicConfig.booking.slotDuration;
  const buffer = clinicConfig.booking.bufferTime;

  for (const config of daySlots) {
    const [startH, startM] = config.startTime.split(":").map(Number);
    const [endH, endM] = config.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let current = startMinutes;
    while (current + duration <= endMinutes) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      current += duration + buffer;
    }
  }

  return slots.sort();
}

/**
 * Get existing appointment counts per time slot for a given date and doctor.
 */
export async function getPublicSlotBookingCounts(
  date: string,
  doctorId: string,
): Promise<Record<string, number>> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from("appointments")
    .select("slot_start, status")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .gte("slot_start", dayStart)
    .lte("slot_start", dayEnd)
    .not("status", "in", '("cancelled","no_show")');

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const appt of data) {
    const time = appt.slot_start?.split("T")[1]?.slice(0, 5) ?? "";
    if (time) {
      counts[time] = (counts[time] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Get available (non-fully-booked) slots for a date and doctor.
 */
export async function getPublicAvailableSlots(
  date: string,
  doctorId: string,
): Promise<string[]> {
  const [allSlots, bookingCounts] = await Promise.all([
    getPublicGeneratedSlots(date, doctorId),
    getPublicSlotBookingCounts(date, doctorId),
  ]);

  const maxPerSlot = clinicConfig.booking.maxPerSlot;
  return allSlots.filter((slot) => (bookingCounts[slot] ?? 0) < maxPerSlot);
}

// ── Blog Posts ──

export async function getPublicBlogPosts(): Promise<PublicBlogPost[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, title, excerpt, published_at, read_time, category")
    .eq("clinic_id", clinicId)
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    title: p.title ?? "",
    excerpt: p.excerpt ?? "",
    date: p.published_at?.split("T")[0] ?? "",
    readTime: p.read_time ?? "",
    category: p.category ?? "",
  }));
}
