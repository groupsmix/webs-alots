/**
 * Multi-location management.
 *
 * Supports clinic chains with centralized administration,
 * location-specific settings, and cross-location reporting.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  clinicId: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  timezone: string;
  workingHours: Record<string, unknown>;
}

export interface LocationCreateInput {
  clinicId: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
  timezone?: string;
  workingHours?: Record<string, unknown>;
}

export interface CrossLocationSummary {
  clinicId: string;
  locations: Array<{
    locationId: string;
    name: string;
    appointmentCount: number;
    revenue: number;
  }>;
  totalAppointments: number;
  totalRevenue: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export async function listLocations(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<Location[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("locations")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("is_primary", { ascending: false });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    clinicId: row.clinic_id as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    isPrimary: (row.is_primary as boolean) ?? false,
    timezone: (row.timezone as string) ?? "Africa/Casablanca",
    workingHours: (row.working_hours as Record<string, unknown>) ?? {},
  }));
}

export async function createLocation(
  supabase: SupabaseClient<Database>,
  input: LocationCreateInput,
): Promise<Location | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("locations")
    .insert({
      clinic_id: input.clinicId,
      name: input.name,
      address: input.address ?? null,
      city: input.city ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      is_primary: input.isPrimary ?? false,
      timezone: input.timezone ?? "Africa/Casablanca",
      working_hours: input.workingHours ?? {},
    })
    .select()
    .single();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    isPrimary: (row.is_primary as boolean) ?? false,
    timezone: (row.timezone as string) ?? "Africa/Casablanca",
    workingHours: (row.working_hours as Record<string, unknown>) ?? {},
  };
}

export async function setPrimaryLocation(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  locationId: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  await client.from("locations").update({ is_primary: false }).eq("clinic_id", clinicId);

  const { error } = await client
    .from("locations")
    .update({ is_primary: true })
    .eq("id", locationId)
    .eq("clinic_id", clinicId);

  return !error;
}
