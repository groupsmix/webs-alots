import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";
import type { BodyMeasurement } from "@/lib/types/para-medical";

export async function fetchBodyMeasurements(clinicId: string): Promise<BodyMeasurement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("measurement_date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load body measurements: ${error.message}`);
  }

  return (data ?? []).map((row: Tables<"body_measurements">) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    measurement_date: row.measurement_date,
    weight_kg: row.weight_kg,
    height_cm: row.height_cm,
    bmi: row.bmi,
    body_fat_pct: row.body_fat_pct,
    waist_cm: row.waist_cm,
    hip_cm: row.hip_cm,
    chest_cm: row.chest_cm,
    arm_cm: row.arm_cm,
    thigh_cm: row.thigh_cm,
    notes: row.notes,
    created_at: row.created_at,
  }));
}
