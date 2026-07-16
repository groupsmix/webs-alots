"use server";

import { createTenantClient } from "@/lib/supabase-server";

export interface ServiceView {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  currency: string;
  active: boolean;
  category?: string;
}

interface ServiceRow {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  duration_min: number | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  is_active: boolean;
}

export async function fetchServices(clinicId: string): Promise<ServiceView[]> {
  const supabase = await createTenantClient(clinicId);

  const { data, error } = await supabase
    .from("services")
    .select(
      "id, clinic_id, name, description, duration_minutes, duration_min, price, currency, category, is_active",
    )
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load services: ${error.message}`);

  return ((data ?? []) as unknown as ServiceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    duration: row.duration_minutes ?? row.duration_min ?? 0,
    price: row.price ?? 0,
    currency: row.currency ?? "MAD",
    active: row.is_active ?? true,
    category: row.category ?? undefined,
  }));
}
