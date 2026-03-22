/**
 * Shared utility for finding or creating a patient record.
 *
 * Extracted from the duplicated pattern in:
 *   - booking/recurring/route.ts
 *   - booking/emergency-slot/route.ts
 *   - booking/waiting-list/route.ts
 *
 * When `patientId` starts with "patient-" it is treated as a temporary ID
 * from the frontend. The function looks up the patient by name within the
 * clinic and creates a new record if none exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Resolve a patient ID — if the incoming ID looks like a temporary placeholder
 * (prefixed with "patient-"), find or create the patient in the database.
 *
 * @returns The resolved patient ID, or `null` if creation failed.
 */
export async function findOrCreatePatient(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  patientId: string,
  patientName: string,
): Promise<string | null> {
  if (!patientId.startsWith("patient-")) {
    return patientId;
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("name", patientName)
    .eq("role", "patient")
    .limit(1)
    .single();

  if (existing) {
    return existing.id;
  }

  const { data: newPatient } = await supabase
    .from("users")
    .insert({
      clinic_id: clinicId,
      name: patientName,
      role: "patient",
    })
    .select("id")
    .single();

  return newPatient?.id ?? null;
}
