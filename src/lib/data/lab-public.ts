/**
 * Server-side data fetching for Lab & Radiology public-facing pages.
 *
 * These functions use the server Supabase client and scope queries
 * to the current clinic via `clinicConfig.clinicId`.
 * Tables are accessed gracefully — if a table doesn't exist yet the
 * function returns an empty array instead of crashing.
 */

import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";

// ── Types ──

export interface LabTest {
  id: string;
  name: string;
  category: string;
  description: string;
  preparationInstructions: string;
  turnaroundTime: string;
  price: number;
  currency: string;
  requiresFasting: boolean;
  sampleType: string;
  active: boolean;
}

export interface CollectionPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  hours: { day: string; open: string; close: string }[];
  isMainLab: boolean;
  hasParking: boolean;
  wheelchairAccessible: boolean;
  coordinates?: { lat: number; lng: number };
}

// ── Helpers ──

function getClinicId(): string {
  return clinicConfig.clinicId;
}

// ── Lab Tests / Exams ──

export async function getPublicLabTests(): Promise<LabTest[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lab_tests")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((t: Record<string, unknown>) => ({
    id: (t.id as string) ?? "",
    name: (t.name as string) ?? "",
    category: (t.category as string) ?? "general",
    description: (t.description as string) ?? "",
    preparationInstructions: (t.preparation_instructions as string) ?? "",
    turnaroundTime: (t.turnaround_time as string) ?? "24-48h",
    price: (t.price as number) ?? 0,
    currency: clinicConfig.currency,
    requiresFasting: (t.requires_fasting as boolean) ?? false,
    sampleType: (t.sample_type as string) ?? "blood",
    active: (t.is_active as boolean) ?? true,
  }));
}

export function getLabTestCategories(tests: LabTest[]): string[] {
  return [...new Set(tests.filter((t) => t.active).map((t) => t.category))].sort();
}

export function searchLabTests(tests: LabTest[], query: string): LabTest[] {
  const q = query.toLowerCase();
  return tests.filter(
    (t) =>
      t.active &&
      (t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)),
  );
}

// ── Collection Points ──

export async function getPublicCollectionPoints(): Promise<CollectionPoint[]> {
  const clinicId = getClinicId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collection_points")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("is_main_lab", { ascending: false });

  if (error || !data) return [];

  return data.map((cp: Record<string, unknown>) => ({
    id: (cp.id as string) ?? "",
    name: (cp.name as string) ?? "",
    address: (cp.address as string) ?? "",
    city: (cp.city as string) ?? "",
    phone: (cp.phone as string) ?? "",
    hours: (cp.hours as CollectionPoint["hours"]) ?? [],
    isMainLab: (cp.is_main_lab as boolean) ?? false,
    hasParking: (cp.has_parking as boolean) ?? false,
    wheelchairAccessible: (cp.wheelchair_accessible as boolean) ?? false,
    coordinates: cp.lat && cp.lng
      ? { lat: cp.lat as number, lng: cp.lng as number }
      : undefined,
  }));
}
