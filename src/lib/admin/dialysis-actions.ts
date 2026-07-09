"use server";

import type { DialysisMachineStatus, TablesInsert, TablesUpdate } from "@/lib/types/database";
import { adminContext } from "./base";

export interface CreateClinicDialysisMachineInput {
  machineName: string;
  machineModel?: string;
  serialNumber?: string;
}

export async function createClinicDialysisMachine(input: CreateClinicDialysisMachineInput) {
  const { clinicId, supabase } = await adminContext();
  const { data, error } = await supabase
    .from("dialysis_machines")
    .insert({
      clinic_id: clinicId,
      machine_name: input.machineName.trim(),
      machine_model: input.machineModel?.trim() || null,
      serial_number: input.serialNumber?.trim() || null,
      status: "available",
    } as TablesInsert<"dialysis_machines">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create dialysis machine: ${error.message}`);
  return data;
}

export async function updateClinicDialysisMachineStatus(
  machineId: string,
  status: DialysisMachineStatus,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const patch: TablesUpdate<"dialysis_machines"> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "available") patch.last_maintenance = new Date().toISOString();

  const { error } = await supabase
    .from("dialysis_machines")
    .update(patch)
    .eq("id", machineId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update machine status: ${error.message}`);
}
