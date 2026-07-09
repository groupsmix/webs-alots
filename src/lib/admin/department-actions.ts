"use server";

import type { TablesInsert, TablesUpdate } from "@/lib/types/database";
import { adminContext } from "./base";

export interface CreateClinicDepartmentInput {
  name: string;
  nameAr?: string;
  floor?: string;
  description?: string;
}

export async function createClinicDepartment(input: CreateClinicDepartmentInput) {
  const { clinicId, supabase } = await adminContext();
  const { data, error } = await supabase
    .from("departments")
    .insert({
      clinic_id: clinicId,
      name: input.name.trim(),
      name_ar: input.nameAr?.trim() || null,
      floor: input.floor?.trim() || null,
      description: input.description?.trim() || null,
      is_active: true,
    } as TablesInsert<"departments">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create department: ${error.message}`);
  return data;
}

export async function setClinicDepartmentActive(
  departmentId: string,
  isActive: boolean,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("departments")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    } as TablesUpdate<"departments">)
    .eq("id", departmentId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update department status: ${error.message}`);
}

export interface CreateClinicRoomInput {
  roomNumber: string;
  roomType: string;
  floor?: string;
  totalBeds: number;
}

export async function createClinicRoom(input: CreateClinicRoomInput) {
  const { clinicId, supabase } = await adminContext();
  const totalBeds = Math.max(1, Math.floor(input.totalBeds || 1));

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      clinic_id: clinicId,
      room_number: input.roomNumber.trim(),
      room_type: input.roomType,
      floor: input.floor?.trim() || null,
      total_beds: totalBeds,
      is_active: true,
    } as TablesInsert<"rooms">)
    .select()
    .single();

  if (roomError) throw new Error(`Failed to create room: ${roomError.message}`);

  const bedRows = Array.from({ length: totalBeds }, (_, index) => ({
    clinic_id: clinicId,
    room_id: room.id,
    department_id: room.department_id ?? null,
    bed_number: String(index + 1),
    status: "available",
  })) as TablesInsert<"beds">[];

  const { error: bedError } = await supabase.from("beds").insert(bedRows);
  if (bedError) throw new Error(`Failed to create room beds: ${bedError.message}`);

  return room;
}
