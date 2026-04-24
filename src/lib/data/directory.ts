/**
 * Data fetching for the public doctor directory (/annuaire).
 *
 * These queries run cross-tenant (no clinic_id scoping) using the
 * admin client because the directory is a platform-wide public listing.
 * Only active clinics and doctors with `is_listed = true` are included.
 */

import { createClient } from "@/lib/supabase-server";
import { cacheLife, cacheTag } from "next/cache";
import { logger } from "@/lib/logger";

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

// ── Types ──

export interface DirectoryDoctor {
  id: string;
  name: string;
  slug: string;
  specialty: string;
  specialtySlug: string;
  city: string;
  citySlug: string;
  clinicName: string;
  clinicSubdomain: string | null;
  address: string | null;
  phone: string | null;
  avatar: string | null;
  consultationFee: number;
  languages: string[];
  bio: string | null;
  clinicId: string;
}

export interface DirectoryClinic {
  id: string;
  name: string;
  subdomain: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
}

// ── Helpers ──

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^(?!dr-)/, "dr-");
}

function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function specialtyToSlug(specialty: string): string {
  // Map common specialty names to their French slugs
  const specialtyMap: Record<string, string> = {
    "dentist": "dentiste",
    "dentiste": "dentiste",
    "general practitioner": "medecin-generaliste",
    "médecin généraliste": "medecin-generaliste",
    "medecin generaliste": "medecin-generaliste",
    "pediatrician": "pediatre",
    "pédiatre": "pediatre",
    "pediatre": "pediatre",
    "gynecologist": "gynecologue",
    "gynécologue": "gynecologue",
    "gynecologue": "gynecologue",
    "ophthalmologist": "ophtalmologue",
    "ophtalmologue": "ophtalmologue",
    "cardiologist": "cardiologue",
    "cardiologue": "cardiologue",
    "dermatologist": "dermatologue",
    "dermatologue": "dermatologue",
    "orthopedist": "orthopediste",
    "orthopédiste": "orthopediste",
    "orthopediste": "orthopediste",
    "neurologist": "neurologue",
    "neurologue": "neurologue",
    "psychiatrist": "psychiatre",
    "psychiatre": "psychiatre",
    "physiotherapist": "kinesitherapeute",
    "kinésithérapeute": "kinesitherapeute",
    "kinesitherapeute": "kinesitherapeute",
    "radiologist": "radiologue",
    "radiologue": "radiologue",
    "nutritionist": "nutritionniste",
    "nutritionniste": "nutritionniste",
    "ent specialist": "orl",
    "orl": "orl",
    "urologist": "urologue",
    "urologue": "urologue",
    "pulmonologist": "pneumologue",
    "pneumologue": "pneumologue",
    "endocrinologist": "endocrinologue",
    "endocrinologue": "endocrinologue",
    "rheumatologist": "rhumatologue",
    "rhumatologue": "rhumatologue",
    "gastroenterologist": "gastro-enterologue",
    "gastro-entérologue": "gastro-enterologue",
    "gastro-enterologue": "gastro-enterologue",
    "nephrologist": "nephrologue",
    "néphrologue": "nephrologue",
    "nephrologue": "nephrologue",
    "pharmacist": "pharmacien",
    "pharmacien": "pharmacien",
    "optician": "opticien",
    "opticien": "opticien",
    "speech therapist": "orthophoniste",
    "orthophoniste": "orthophoniste",
    "psychologist": "psychologue",
    "psychologue": "psychologue",
  };

  const lower = specialty.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return specialtyMap[lower] ?? lower.replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}

// ── Data fetching ──

async function fetchDirectoryDoctors(): Promise<DirectoryDoctor[]> {
  try {
    const { createAdminClient } = await import("@/lib/supabase-server");
    const supabase = createAdminClient();

    // Fetch all doctors from active clinics
    const { data: doctors, error: doctorsError } = await supabase
      .from("users")
      .select("id, name, phone, email, avatar_url, metadata, clinic_id")
      .eq("role", "doctor")
      .order("name", { ascending: true });

    if (doctorsError || !doctors) {
      logger.warn("Failed to fetch directory doctors", { context: "directory", error: doctorsError });
      return [];
    }

    // Fetch active clinics
    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select("id, name, subdomain, phone, address, logo_url, config")
      .eq("status", "active");

    if (clinicsError || !clinics) {
      logger.warn("Failed to fetch directory clinics", { context: "directory", error: clinicsError });
      return [];
    }

    const clinicMap = new Map(clinics.map((c) => [c.id, c]));

    return doctors
      .map((d) => {
        if (!d.clinic_id) return null;
        const clinic = clinicMap.get(d.clinic_id);
        if (!clinic) return null;

        const meta = (d.metadata ?? {}) as UserMetadata;
        const specialty = meta.specialty ?? "";
        const cfg = (clinic.config ?? {}) as ClinicConfigJson;
        const city = cfg.city ?? (clinic.address?.split(",").pop()?.trim() ?? "");

        if (!specialty || !city) return null;

        return {
          id: d.id,
          name: d.name,
          slug: nameToSlug(d.name),
          specialty,
          specialtySlug: specialtyToSlug(specialty),
          city,
          citySlug: cityToSlug(city),
          clinicName: clinic.name ?? "",
          clinicSubdomain: clinic.subdomain,
          address: clinic.address ?? cfg.address ?? null,
          phone: d.phone ?? clinic.phone ?? null,
          avatar: d.avatar_url ?? null,
          consultationFee: meta.consultation_fee ?? 0,
          languages: meta.languages ?? [],
          bio: meta.bio ?? null,
          clinicId: d.clinic_id,
        };
      })
      .filter((d): d is DirectoryDoctor => d !== null);
  } catch (err) {
    logger.error("Failed to fetch directory data", { context: "directory", error: err });
    return [];
  }
}

// ── Public API ──

/** Fetch all listed doctors across all clinics */
export async function getDirectoryDoctors(): Promise<DirectoryDoctor[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("directory");

  return fetchDirectoryDoctors();
}

/** Fetch doctors filtered by city slug */
export async function getDirectoryDoctorsByCity(citySlug: string): Promise<DirectoryDoctor[]> {
  const all = await getDirectoryDoctors();
  return all.filter((d) => d.citySlug === citySlug);
}

/** Fetch doctors filtered by city + specialty slug */
export async function getDirectoryDoctorsByCityAndSpecialty(
  citySlug: string,
  specialtySlug: string,
): Promise<DirectoryDoctor[]> {
  const all = await getDirectoryDoctors();
  return all.filter((d) => d.citySlug === citySlug && d.specialtySlug === specialtySlug);
}

/** Fetch a single doctor by their slug */
export async function getDirectoryDoctorBySlug(slug: string): Promise<DirectoryDoctor | null> {
  const all = await getDirectoryDoctors();
  return all.find((d) => d.slug === slug) ?? null;
}

/** Get all unique cities that have at least one doctor */
export async function getDirectoryCities(): Promise<{ slug: string; name: string; count: number }[]> {
  const all = await getDirectoryDoctors();
  const cityMap = new Map<string, { name: string; count: number }>();

  for (const d of all) {
    const existing = cityMap.get(d.citySlug);
    if (existing) {
      existing.count++;
    } else {
      cityMap.set(d.citySlug, { name: d.city, count: 1 });
    }
  }

  return Array.from(cityMap.entries())
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Get all unique specialties that have at least one doctor */
export async function getDirectorySpecialties(): Promise<{ slug: string; name: string; count: number }[]> {
  const all = await getDirectoryDoctors();
  const specMap = new Map<string, { name: string; count: number }>();

  for (const d of all) {
    const existing = specMap.get(d.specialtySlug);
    if (existing) {
      existing.count++;
    } else {
      specMap.set(d.specialtySlug, { name: d.specialty, count: 1 });
    }
  }

  return Array.from(specMap.entries())
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Get specialties available in a specific city */
export async function getDirectorySpecialtiesInCity(
  citySlug: string,
): Promise<{ slug: string; name: string; count: number }[]> {
  const cityDoctors = await getDirectoryDoctorsByCity(citySlug);
  const specMap = new Map<string, { name: string; count: number }>();

  for (const d of cityDoctors) {
    const existing = specMap.get(d.specialtySlug);
    if (existing) {
      existing.count++;
    } else {
      specMap.set(d.specialtySlug, { name: d.specialty, count: 1 });
    }
  }

  return Array.from(specMap.entries())
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => b.count - a.count);
}
