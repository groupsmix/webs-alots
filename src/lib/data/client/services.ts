"use client";

import { fetchRows } from "./_core";

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────

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

interface ServiceRaw {
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
  created_at: string;
}

function mapService(raw: ServiceRaw): ServiceView {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    duration: raw.duration_minutes ?? raw.duration_min ?? 30,
    price: raw.price ?? 0,
    currency: raw.currency ?? "MAD",
    active: raw.is_active ?? true,
    category: raw.category ?? undefined,
  };
}

export async function fetchServices(clinicId: string): Promise<ServiceView[]> {
  const rows = await fetchRows<ServiceRaw>("services", {
    eq: [["clinic_id", clinicId]],
    tenantClinicId: clinicId,
  });
  return rows.map(mapService);
}

