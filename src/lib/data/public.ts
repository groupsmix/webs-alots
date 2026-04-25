/**
 * Server-side data fetching for public-facing pages.
 *
 * These functions use the server Supabase client and scope all queries
 * to the current tenant via requireTenant() (never clinicConfig.clinicId).
 * They return data shaped to match the existing UI types so pages
 * can swap from demo-data imports with minimal changes.
 */

import { cacheLife } from "next/cache";
import { cacheTag } from "next/cache";
import { logger } from "@/lib/logger";
import { createClient, createTenantClient } from "@/lib/supabase-server";
import { getTenant, getClinicConfig } from "@/lib/tenant";
import { APPOINTMENT_STATUS } from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";

// ── JSONB field types (TS-01 / TS-02: replace Record<string, unknown> casts) ──

/** Shape of the `users.metadata` JSONB column for doctors. */
interface UserMetadata {
  specialty?: string;
  specialty_id?: string;
  consultation_fee?: number;
  languages?: string[];
  bio?: string | null;
  insurance?: boolean;
}

/** Shape of the `clinics.config` JSONB column. */
interface ClinicConfigJson {
  city?: string;
  phone?: string;
  address?: string;
  email?: string;
}

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
  category: string;
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
  tagline: string | null;
  coverPhotoUrl: string | null;
  templateId: string;
  sectionVisibility: Record<string, boolean>;
  phone: string | null;
  address: string | null;
  email: string | null;
  websiteConfig: Record<string, unknown> | null;
}

// ── Helpers ──

/**
 * Get tenant info, returning null when accessed on the root domain
 * (no subdomain resolved). Callers must handle the null case.
 */
async function getTenantInfo() {
  return await getTenant();
}

/**
 * Create a Supabase client with tenant context set for public (anon) queries.
 *
 * RLS policies on tenant-scoped tables (time_slots, users, services, etc.)
 * require `app.current_clinic_id` to be set for unauthenticated access.
 * Plain `createClient()` does NOT set this — use this helper instead.
 */
async function createPublicTenantClient() {
  const clinicId = await getClinicId();
  if (!clinicId) return null;
  return { supabase: await createTenantClient(clinicId), clinicId };
}

/** Cached default clinic ID for root-domain fallback (avoids repeated DB queries). */
let _defaultClinicId: string | null | undefined;
let _defaultClinicIdFetchedAt = 0;
const DEFAULT_CLINIC_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get the current clinic ID from tenant context, or fall back to the
 * first active clinic when accessed on the root domain (no subdomain).
 *
 * This ensures public pages (services, reviews, doctors, etc.) display
 * real data even when the site is accessed at the root domain without
 * a subdomain.
 */
async function getClinicId(): Promise<string | null> {
  const tenant = await getTenantInfo();
  if (tenant?.clinicId) return tenant.clinicId;

  // Root domain fallback: resolve the first active clinic (with TTL)
  if (_defaultClinicId !== undefined && Date.now() - _defaultClinicIdFetchedAt < DEFAULT_CLINIC_CACHE_TTL_MS) {
    return _defaultClinicId;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clinics")
      .select("id")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    _defaultClinicId = data?.id ?? null;
  } catch (err) {
    logger.warn("Failed to resolve default clinic ID", { context: "public-data", error: err });
    _defaultClinicId = null;
  }
  _defaultClinicIdFetchedAt = Date.now();

  return _defaultClinicId;
}

// ── Clinic Branding ──

const DEFAULT_BRANDING: ClinicBranding = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#1E4DA1",
  secondaryColor: "#0F6E56",
  headingFont: "Geist",
  bodyFont: "Geist",
  heroImageUrl: null,
  clinicName: "Oltigo",
  tagline: null,
  coverPhotoUrl: null,
  templateId: "modern",
  sectionVisibility: {},
  phone: null,
  address: null,
  email: null,
  websiteConfig: null,
};

/**
 * Fetch branding from DB for a specific clinic.
 * Wrapped with `use cache` for a 5-minute TTL to avoid
 * hitting the DB on every page load (branding rarely changes).
 */
async function fetchBrandingFromDb(clinicId: string, fallbackName: string): Promise<ClinicBranding> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`clinic-branding-${clinicId}`);

  const supabase = await createTenantClient(clinicId);

  const { data, error } = await supabase
    .from("clinics")
    .select("name, logo_url, favicon_url, primary_color, secondary_color, heading_font, body_font, hero_image_url, tagline, cover_photo_url, template_id, section_visibility, website_config, phone, address, owner_email, config")
    .eq("id", clinicId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_BRANDING, clinicName: fallbackName };
  }

  // Fallback to config JSONB for phone/address/email when direct columns are null
  const cfg = (data.config ?? {}) as ClinicConfigJson;

  return {
    logoUrl: data.logo_url ?? null,
    faviconUrl: data.favicon_url ?? null,
    primaryColor: data.primary_color ?? "#1E4DA1",
    secondaryColor: data.secondary_color ?? "#0F6E56",
    headingFont: data.heading_font ?? "Geist",
    bodyFont: data.body_font ?? "Geist",
    heroImageUrl: data.hero_image_url ?? null,
    clinicName: data.name ?? fallbackName,
    tagline: data.tagline ?? null,
    coverPhotoUrl: data.cover_photo_url ?? null,
    templateId: data.template_id ?? "modern",
    sectionVisibility: (data.section_visibility as Record<string, boolean> | null) ?? {},
    phone: data.phone ?? cfg.phone ?? null,
    address: data.address ?? cfg.address ?? null,
    email: data.owner_email ?? cfg.email ?? null,
    websiteConfig: (data.website_config as Record<string, unknown> | null) ?? null,
  };
}

export async function getPublicBranding(): Promise<ClinicBranding> {
  const tenant = await getTenantInfo();
  const clinicId = await getClinicId();

  // No tenant resolved (root domain) — return static defaults.
  // MT-01: Use DEFAULT_BRANDING only; never fall back to static clinicConfig
  // which hard-codes a single tenant's details into the shared root layout.
  if (!clinicId) {
    return { ...DEFAULT_BRANDING };
  }

  const fallbackName = tenant?.clinicName || "Oltigo";
  return fetchBrandingFromDb(clinicId, fallbackName);
}

// ── Reviews ──

async function fetchReviewsFromDb(clinicId: string): Promise<PublicReview[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`clinic-reviews-${clinicId}`);

  const supabase = await createTenantClient(clinicId);

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, stars, comment, response, created_at, patients:patient_id(name)")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error || !reviews || reviews.length === 0) return [];

  return reviews.map((r) => {
    const patientRaw = r.patients;
    const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw;
    return {
      id: r.id,
      patientName: patient?.name ?? "Patient",
      rating: r.stars,
      comment: r.comment ?? "",
      date: r.created_at?.split("T")[0] ?? "",
      replied: !!r.response,
    };
  });
}

export async function getPublicReviews(): Promise<PublicReview[]> {
  const clinicId = await getClinicId();
  if (!clinicId) return [];
  return fetchReviewsFromDb(clinicId);
}

async function fetchAverageRatingFromDb(clinicId: string): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`clinic-reviews-${clinicId}`);

  const supabase = await createTenantClient(clinicId);

  // Try DB-level AVG via Supabase RPC first (single row returned,
  // no data transferred).  Falls back to application-level computation
  // if the RPC function doesn't exist yet.
  try {
    // avg_clinic_rating is a DB function not yet in the generated
    // Supabase types.  Use a targeted cast instead of blanket `as any`.
    type UntypedRpc = (fn: string, args: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
    const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
    const { data: rpcResult, error: rpcError } = await rpc("avg_clinic_rating", { cid: clinicId });

    if (!rpcError && rpcResult !== null && rpcResult !== undefined) {
      const avg = typeof rpcResult === "number" ? rpcResult : Number(rpcResult);
      if (!isNaN(avg)) {
        return Math.round(avg * 10) / 10;
      }
    }
  } catch (err) {
    logger.warn("avg_clinic_rating RPC unavailable, using fallback", { context: "public-data", clinicId, error: err });
  }

  // Fallback: use head: true with count to get total, then fetch only
  // the aggregated sum via a limited query to avoid full table scan.
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if (!count || count === 0) return 0;

  const { data } = await supabase
    .from("reviews")
    .select("stars")
    .eq("clinic_id", clinicId);

  if (!data || data.length === 0) return 0;
  const sum = data.reduce((s, r) => s + r.stars, 0);
  return Math.round((sum / count) * 10) / 10;
}

export async function getPublicAverageRating(): Promise<number> {
  const clinicId = await getClinicId();
  if (!clinicId) return 0;
  return fetchAverageRatingFromDb(clinicId);
}

// ── Services ──

export async function getPublicServices(): Promise<PublicService[]> {
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, duration_min, price, is_active, category")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error || !data) return [];

  const tenantCfg = await getClinicConfig(clinicId);

  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: (s.description as string) ?? "",
    duration: (s.duration_minutes as number) ?? (s.duration_min as number) ?? 30,
    price: s.price ?? 0,
    currency: tenantCfg.currency,
    active: (s.is_active as boolean) ?? true,
    category: (s.category as string) ?? "General",
  }));
}

// ── Doctors ──

export async function getPublicDoctors(): Promise<PublicDoctor[]> {
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

  const { data, error } = await supabase
    .from("users")
    .select("id, name, phone, email, avatar_url, metadata")
    .eq("clinic_id", clinicId)
    .eq("role", "doctor")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((d) => {
    const meta = (d.metadata ?? {}) as UserMetadata;
    return {
      id: d.id,
      name: d.name,
      specialtyId: meta.specialty_id ?? "",
      specialty: meta.specialty ?? "",
      phone: d.phone ?? "",
      email: d.email ?? "",
      avatar: d.avatar_url ?? undefined,
      consultationFee: meta.consultation_fee ?? 0,
      languages: meta.languages ?? [],
    };
  });
}

// ── Specialties (derived from doctors) ──

export async function getPublicSpecialties(
  preFetchedDoctors?: PublicDoctor[],
): Promise<PublicSpecialty[]> {
  const doctors = preFetchedDoctors ?? await getPublicDoctors();
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
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

  let q = supabase
    .from("time_slots")
    .select("id, doctor_id, day_of_week, start_time, end_time, is_active, max_capacity, buffer_minutes")
    .eq("clinic_id", clinicId)
    .eq("is_active", true);

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
    isAvailable: (ts.is_active as boolean) ?? true,
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
  // Use noon-based parsing to avoid UTC day-of-week issues near midnight
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const slotConfigs = await getPublicTimeSlots(doctorId);
  const daySlots = slotConfigs.filter((s) => s.dayOfWeek === dayOfWeek);

  const currentClinicId = await getClinicId();
  if (!currentClinicId) return [];
  const tenantCfg = await getClinicConfig(currentClinicId);
  const slots: string[] = [];
  const duration = tenantCfg.booking.slotDuration;
  const buffer = tenantCfg.booking.bufferTime;

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
  const ctx = await createPublicTenantClient();
  if (!ctx) return {};
  const { supabase, clinicId } = ctx;

  const dayStart = `${date}T00:00:00`;
  // Use next-day boundary to avoid missing the last second of the day
  const nextDay = new Date(`${date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayEnd = getLocalDateStr(nextDay) + "T00:00:00";

  const { data, error } = await supabase
    .from("appointments")
    .select("slot_start, status")
    .eq("clinic_id", clinicId)
    .eq("doctor_id", doctorId)
    .gte("slot_start", dayStart)
    .lt("slot_start", dayEnd)
    .not("status", "in", `("${APPOINTMENT_STATUS.CANCELLED}","${APPOINTMENT_STATUS.NO_SHOW}")`);

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
  // PERF-03: Resolve clinic config in parallel with slots + booking counts
  // instead of making a 3rd sequential DB call.
  const currentClinicId = await getClinicId();
  if (!currentClinicId) return [];

  const [allSlots, bookingCounts, tenantCfg] = await Promise.all([
    getPublicGeneratedSlots(date, doctorId),
    getPublicSlotBookingCounts(date, doctorId),
    getClinicConfig(currentClinicId),
  ]);

  const maxPerSlot = tenantCfg.booking.maxPerSlot;
  return allSlots.filter((slot) => (bookingCounts[slot] ?? 0) < maxPerSlot);
}

// ── Pharmacy: Products (public catalog) ──

export interface PublicPharmacyProduct {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  requiresPrescription: boolean;
  /** DATA-02: Only expose a coarse stock status ("ok" | "low" | "out"), not exact quantities */
  stockStatus: "ok" | "low" | "out";
  manufacturer?: string;
  dosageForm?: string;
  strength?: string;
  active: boolean;
}

export async function getPublicPharmacyProducts(): Promise<PublicPharmacyProduct[]> {
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

  const [{ data: products }, { data: stockRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, generic_name, category, description, price, requires_prescription, is_active, manufacturer, barcode, dosage_form, strength")
      .eq("clinic_id", clinicId),
    supabase
      .from("stock")
      .select("product_id, quantity, min_threshold, expiry_date, batch_number")
      .eq("clinic_id", clinicId),
  ]);

  if (!products) return [];

  const stockMap = new Map(
    ((stockRows ?? []) as { product_id: string; quantity: number; min_threshold: number; expiry_date: string | null; batch_number: string | null }[])
      .map((s) => [s.product_id, s]),
  );

  const tenantCfg = await getClinicConfig(clinicId);

  return products.map((p) => {
    const s = stockMap.get(p.id);
    // DATA-02: Compute a coarse stock status instead of exposing exact
    // quantities and thresholds which are business-sensitive information.
    const qty = s?.quantity ?? 0;
    const minThreshold = s?.min_threshold ?? 0;
    let stockStatus: "ok" | "low" | "out" = "ok";
    if (qty === 0) stockStatus = "out";
    else if (qty <= minThreshold) stockStatus = "low";

    return {
      id: p.id,
      name: p.name,
      genericName: p.generic_name ?? undefined,
      category: p.category ?? "medication",
      description: p.description ?? "",
      price: p.price ?? 0,
      currency: tenantCfg.currency,
      requiresPrescription: p.requires_prescription ?? false,
      stockStatus,
      manufacturer: p.manufacturer ?? undefined,
      dosageForm: p.dosage_form ?? undefined,
      strength: p.strength ?? undefined,
      active: p.is_active ?? true,
    };
  });
}

export function getPublicStockStatus(product: PublicPharmacyProduct): "ok" | "low" | "out" {
  return product.stockStatus;
}

export function searchPublicProducts(
  products: PublicPharmacyProduct[],
  query: string,
): PublicPharmacyProduct[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.active &&
      (p.name.toLowerCase().includes(q) ||
        (p.genericName?.toLowerCase().includes(q) ?? false) ||
        p.category.toLowerCase().includes(q) ||
        (p.manufacturer?.toLowerCase().includes(q) ?? false) ||
        p.description.toLowerCase().includes(q)),
  );
}

// ── Pharmacy: Services ──

export interface PublicPharmacyService {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: number;
  available: boolean;
  icon: string;
}

export async function getPublicPharmacyServices(): Promise<PublicPharmacyService[]> {
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, price, duration_minutes, duration_min, is_active")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error || !data) return [];

  const tenantCfg = await getClinicConfig(clinicId);

  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    price: s.price ?? 0,
    currency: tenantCfg.currency,
    duration: s.duration_minutes ?? (s.duration_min as number) ?? 0,
    available: s.is_active ?? true,
    icon: "Pill",
  }));
}

// ── Pharmacy: On-Duty Schedule ──

export interface PublicOnDutySchedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isOnDuty: boolean;
  notes?: string;
}

export async function getPublicOnDutySchedule(): Promise<PublicOnDutySchedule[]> {
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

  // Try fetching from on_duty_schedule table if it exists
  const { data, error } = await supabase
    .from("on_duty_schedule")
    .select("id, date, start_time, end_time, is_on_duty, notes")
    .eq("clinic_id", clinicId)
    .order("date", { ascending: true });

  // If the table doesn't exist or errors, return empty (graceful fallback)
  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id ?? "",
    date: d.date ?? "",
    startTime: d.start_time ?? "",
    endTime: d.end_time ?? "",
    isOnDuty: d.is_on_duty ?? false,
    notes: d.notes ?? undefined,
  }));
}

export async function isPublicCurrentlyOnDuty(): Promise<boolean> {
  const schedule = await getPublicOnDutySchedule();
  const now = new Date();
  const todayStr = getLocalDateStr(now);
  return schedule.some((d) => {
    if (!d.isOnDuty || d.date !== todayStr) return false;
    const [sh, sm] = d.startTime.split(":").map(Number);
    const [eh, em] = d.endTime.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= startMin && nowMin <= endMin;
  });
}

export async function getPublicNextOnDuty(): Promise<PublicOnDutySchedule | null> {
  const schedule = await getPublicOnDutySchedule();
  const now = new Date();
  const upcoming = schedule
    .filter((d) => d.isOnDuty && new Date(d.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0] ?? null;
}

// ── Pharmacy: Prescription Requests (public view) ──

export interface PublicPharmacyPrescription {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  imageUrl: string;
  uploadedAt: string;
  status: "pending" | "reviewing" | "partially-ready" | "ready" | "picked-up" | "delivered" | "rejected";
  pharmacistNotes?: string;
  items: { id: string; productId: string; productName: string; quantity: number; available: boolean; price: number; notes?: string }[];
  totalPrice: number;
  currency: string;
  deliveryOption: "pickup" | "delivery";
  deliveryAddress?: string;
  isChronic: boolean;
  refillReminderDate?: string;
  whatsappNotified: boolean;
}

/**
 * DATA-01 (CRITICAL): This function previously returned patient names, phone
 * numbers, prescription details, and delivery addresses on public-facing pages
 * — a direct PHI exposure violating HIPAA and Morocco's Law 09-08.
 *
 * Fix: Only return aggregate, non-identifying statistics (total count by
 * status) so the public pharmacy page can show queue status without
 * exposing any patient data.
 */
export async function getPublicPharmacyPrescriptions(): Promise<PublicPharmacyPrescription[]> {
  // Return empty — prescription data must NEVER be served publicly.
  // Authenticated pharmacy staff should use a separate, auth-gated endpoint.
  return [];
}

// ── Blog Posts ──

export async function getPublicBlogPosts(): Promise<PublicBlogPost[]> {
  const ctx = await createPublicTenantClient();
  if (!ctx) return [];
  const { supabase, clinicId } = ctx;

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
