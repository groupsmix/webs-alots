"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";
import { createClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

// ─────────────────────────────────────────────
// Medical Equipment — Inventory
// ─────────────────────────────────────────────

export interface EquipmentItemView {
  id: string;
  name: string;
  description?: string;
  category: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency: string;
  condition: string;
  isAvailable: boolean;
  isRentable: boolean;
  rentalPriceDaily?: number;
  rentalPriceWeekly?: number;
  rentalPriceMonthly?: number;
  imageUrl?: string;
  notes?: string;
}

interface EquipmentItemRaw {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  category: string;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency: string;
  condition: string;
  is_available: boolean;
  is_rentable: boolean;
  rental_price_daily: number | null;
  rental_price_weekly: number | null;
  rental_price_monthly: number | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapEquipmentItem(raw: EquipmentItemRaw): EquipmentItemView {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    category: raw.category,
    serialNumber: raw.serial_number ?? undefined,
    model: raw.model ?? undefined,
    manufacturer: raw.manufacturer ?? undefined,
    purchaseDate: raw.purchase_date ?? undefined,
    purchasePrice: raw.purchase_price ?? undefined,
    currency: raw.currency ?? "MAD",
    condition: raw.condition ?? "good",
    isAvailable: raw.is_available ?? true,
    isRentable: raw.is_rentable ?? true,
    rentalPriceDaily: raw.rental_price_daily ?? undefined,
    rentalPriceWeekly: raw.rental_price_weekly ?? undefined,
    rentalPriceMonthly: raw.rental_price_monthly ?? undefined,
    imageUrl: raw.image_url ?? undefined,
    notes: raw.notes ?? undefined,
  };
}

export async function fetchEquipmentInventory(clinicId: string): Promise<EquipmentItemView[]> {
  const rows = await fetchRows<EquipmentItemRaw>("equipment_inventory", {
    eq: [["clinic_id", clinicId]],
    order: ["name", { ascending: true }],
  });
  return rows.map(mapEquipmentItem);
}

// ─────────────────────────────────────────────
// Medical Equipment — Rentals
// ─────────────────────────────────────────────

export interface EquipmentRentalView {
  id: string;
  equipmentId: string;
  equipmentName: string;
  clientName: string;
  clientPhone?: string;
  clientIdNumber?: string;
  rentalStart: string;
  rentalEnd?: string;
  actualReturn?: string;
  status: string;
  conditionOut: string;
  conditionIn?: string;
  depositAmount?: number;
  rentalAmount?: number;
  currency: string;
  paymentStatus: string;
  notes?: string;
}

interface EquipmentRentalRaw {
  id: string;
  clinic_id: string;
  equipment_id: string;
  client_name: string;
  client_phone: string | null;
  client_id_number: string | null;
  rental_start: string;
  rental_end: string | null;
  actual_return: string | null;
  status: string;
  condition_out: string;
  condition_in: string | null;
  deposit_amount: number | null;
  rental_amount: number | null;
  currency: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
}

export async function fetchEquipmentRentals(clinicId: string): Promise<EquipmentRentalView[]> {
  const equipment = await fetchEquipmentInventory(clinicId);
  const equipMap = new Map(equipment.map((e) => [e.id, e.name]));
  const rows = await fetchRows<EquipmentRentalRaw>("equipment_rentals", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: equipMap.get(r.equipment_id) ?? "Equipment",
    clientName: r.client_name,
    clientPhone: r.client_phone ?? undefined,
    clientIdNumber: r.client_id_number ?? undefined,
    rentalStart: r.rental_start,
    rentalEnd: r.rental_end ?? undefined,
    actualReturn: r.actual_return ?? undefined,
    status: r.status,
    conditionOut: r.condition_out ?? "good",
    conditionIn: r.condition_in ?? undefined,
    depositAmount: r.deposit_amount ?? undefined,
    rentalAmount: r.rental_amount ?? undefined,
    currency: r.currency ?? "MAD",
    paymentStatus: r.payment_status ?? "pending",
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Medical Equipment — Maintenance
// ─────────────────────────────────────────────

export interface EquipmentMaintenanceView {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: string;
  description?: string;
  performedBy?: string;
  performedAt: string;
  nextDue?: string;
  cost?: number;
  currency: string;
  status: string;
  notes?: string;
}

interface EquipmentMaintenanceRaw {
  id: string;
  clinic_id: string;
  equipment_id: string;
  type: string;
  description: string | null;
  performed_by: string | null;
  performed_at: string;
  next_due: string | null;
  cost: number | null;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export async function fetchEquipmentMaintenance(clinicId: string): Promise<EquipmentMaintenanceView[]> {
  const equipment = await fetchEquipmentInventory(clinicId);
  const equipMap = new Map(equipment.map((e) => [e.id, e.name]));
  const rows = await fetchRows<EquipmentMaintenanceRaw>("equipment_maintenance", {
    eq: [["clinic_id", clinicId]],
    order: ["performed_at", { ascending: false }],
  });
  return rows.map((r) => ({
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: equipMap.get(r.equipment_id) ?? "Equipment",
    type: r.type,
    description: r.description ?? undefined,
    performedBy: r.performed_by ?? undefined,
    performedAt: r.performed_at,
    nextDue: r.next_due ?? undefined,
    cost: r.cost ?? undefined,
    currency: r.currency ?? "MAD",
    status: r.status ?? "completed",
    notes: r.notes ?? undefined,
  }));
}

// ─────────────────────────────────────────────
// Medical Equipment — Inventory Mutations
// ─────────────────────────────────────────────

export async function createEquipmentItem(data: {
  clinic_id: string;
  name: string;
  description?: string;
  category: string;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  purchase_date?: string;
  purchase_price?: number;
  currency?: string;
  condition?: string;
  is_available?: boolean;
  is_rentable?: boolean;
  rental_price_daily?: number;
  rental_price_weekly?: number;
  rental_price_monthly?: number;
  image_url?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from("equipment_inventory")
    .insert({
      ...data,
      currency: data.currency ?? "MAD",
      condition: data.condition ?? "new",
      is_available: data.is_available ?? true,
      is_rentable: data.is_rentable ?? false,
    })
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateEquipmentItem(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    category: string;
    serial_number: string | null;
    model: string | null;
    manufacturer: string | null;
    purchase_date: string | null;
    purchase_price: number | null;
    currency: string;
    condition: string;
    is_available: boolean;
    is_rentable: boolean;
    rental_price_daily: number | null;
    rental_price_weekly: number | null;
    rental_price_monthly: number | null;
    image_url: string | null;
    notes: string | null;
  }>,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("equipment_inventory")
    .update({ ...data, updated_at: new Date().toISOString() } as Database["public"]["Tables"]["equipment_inventory"]["Update"])
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function deleteEquipmentItem(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("equipment_inventory").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Medical Equipment — Rental Mutations
// ─────────────────────────────────────────────

export async function createEquipmentRental(data: {
  clinic_id: string;
  equipment_id: string;
  client_name: string;
  client_phone?: string;
  client_id_number?: string;
  rental_start: string;
  rental_end?: string;
  status?: string;
  condition_out: string;
  deposit_amount?: number;
  rental_amount?: number;
  currency?: string;
  payment_status?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("equipment_rentals")
    .insert({
      ...data,
      status: data.status ?? "active",
      currency: data.currency ?? "MAD",
      payment_status: data.payment_status ?? "pending",
    } as Database["public"]["Tables"]["equipment_rentals"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateEquipmentRental(
  id: string,
  data: Partial<{
    client_name: string;
    client_phone: string | null;
    client_id_number: string | null;
    rental_start: string;
    rental_end: string | null;
    actual_return: string | null;
    status: string;
    condition_out: string;
    condition_in: string | null;
    deposit_amount: number | null;
    rental_amount: number | null;
    currency: string;
    payment_status: string;
    notes: string | null;
  }>,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("equipment_rentals")
    .update(data as Database["public"]["Tables"]["equipment_rentals"]["Update"])
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function deleteEquipmentRental(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("equipment_rentals").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Medical Equipment — Maintenance Mutations
// ─────────────────────────────────────────────

export async function createEquipmentMaintenance(data: {
  clinic_id: string;
  equipment_id: string;
  type: string;
  description?: string;
  performed_by?: string;
  performed_at: string;
  next_due?: string;
  cost?: number;
  currency?: string;
  status?: string;
  notes?: string;
}): Promise<string | null> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from("equipment_maintenance")
    .insert({
      ...data,
      currency: data.currency ?? "MAD",
      status: data.status ?? "scheduled",
    } as Database["public"]["Tables"]["equipment_maintenance"]["Insert"])
    .select("id")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return null;
  }
  return result?.id ?? null;
}

export async function updateEquipmentMaintenance(
  id: string,
  data: Partial<{
    equipment_id: string;
    type: string;
    description: string | null;
    performed_by: string | null;
    performed_at: string;
    next_due: string | null;
    cost: number | null;
    currency: string;
    status: string;
    notes: string | null;
  }>,
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("equipment_maintenance")
    .update(data as Database["public"]["Tables"]["equipment_maintenance"]["Update"])
    .eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

export async function deleteEquipmentMaintenance(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("equipment_maintenance").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
