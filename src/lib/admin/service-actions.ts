"use server";

import type { TablesInsert, TablesUpdate } from "@/lib/types/database";
import { adminContext, type ClinicServiceRow } from "./base";

export interface CreateClinicServiceInput {
  name: string;
  description?: string;
  duration_minutes: number;
  price?: number;
  currency?: string;
  category?: string;
  is_active?: boolean;
}

export async function createClinicService(
  input: CreateClinicServiceInput,
): Promise<ClinicServiceRow> {
  const { clinicId, supabase } = await adminContext();

  const name = input.name.trim();
  if (!name) throw new Error("Service name is required");

  const insertPayload: Record<string, unknown> = {
    clinic_id: clinicId,
    name,
    description: input.description?.trim() || null,
    duration_minutes: input.duration_minutes,
    price: input.price ?? null,
    currency: input.currency ?? "MAD",
    category: input.category?.trim() || null,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from("services") // nosemgrep: semgrep.tenant-scoping — clinic_id is inside insertPayload (derived from authenticated profile); INSERT has no .eq() chain by design
    .insert(insertPayload as TablesInsert<"services">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create service: ${error.message}`);
  return data as unknown as ClinicServiceRow;
}

export interface UpdateClinicServiceInput {
  name?: string;
  description?: string;
  duration_minutes?: number;
  price?: number;
  currency?: string;
  category?: string;
  is_active?: boolean;
}

export async function updateClinicService(
  serviceId: string,
  patch: UpdateClinicServiceInput,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.description !== undefined) update.description = patch.description.trim() || null;
  if (patch.duration_minutes !== undefined) update.duration_minutes = patch.duration_minutes;
  if (patch.price !== undefined) update.price = patch.price;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.category !== undefined) update.category = patch.category.trim() || null;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;

  const { error } = await supabase
    .from("services")
    .update(update as TablesUpdate<"services">)
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update service: ${error.message}`);
}

export async function setClinicServiceActive(serviceId: string, isActive: boolean): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive } as TablesUpdate<"services">)
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to update service status: ${error.message}`);
}

export async function deleteClinicService(serviceId: string): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to delete service: ${error.message}`);
}
