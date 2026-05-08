/**
 * Shared utility for finding or creating a patient record.
 *
 * Extracted from the duplicated pattern in:
 *   - booking/recurring/route.ts
 *   - booking/emergency-slot/route.ts
 *   - booking/waiting-list/route.ts
 *
 * When `patientId` starts with "patient-" it is treated as a temporary ID
 * from the frontend. The function looks up the patient by phone (preferred)
 * or name within the clinic and creates a new record if none exists.
 *
 * Using phone as the primary lookup key avoids name-collision issues
 * (e.g. two patients named "Mohammed Ahmed" in the same clinic).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

interface FindOrCreatePatientOptions {
  phone?: string;
  email?: string;
}

/**
 * Resolve a patient ID — if the incoming ID looks like a temporary placeholder
 * (prefixed with "patient-"), find or create the patient in the database.
 *
 * Prefers phone-based lookup over name-based to avoid name collisions.
 *
 * @returns The resolved patient ID, or `null` if creation failed.
 */
export async function findOrCreatePatient(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  patientId: string,
  patientName: string,
  options?: FindOrCreatePatientOptions,
): Promise<string | null> {
  if (!patientId.startsWith("patient-")) {
    return patientId;
  }

  // Prefer phone-based lookup (unique per clinic) over name-based
  // to avoid assigning appointments to the wrong patient when names collide.
  if (options?.phone) {
    const { data: byPhone } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", options.phone)
      .eq("role", "patient")
      .limit(1)
      .single();

    if (byPhone) {
      return byPhone.id;
    }
  }

  // Fall back to name-based lookup when phone is not provided.
  // Only reuse an existing record when exactly ONE patient matches
  // to avoid silently attributing data to the wrong person when
  // multiple patients share the same name (common in many cultures).
  const { data: byName } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("name", patientName)
    .eq("role", "patient")
    .limit(2); // fetch up to 2 to detect ambiguity

  if (byName && byName.length === 1) {
    return byName[0].id;
  }
  // If 0 or 2+ matches, fall through to create a new patient record
  // so we don't accidentally merge distinct individuals.

  const { data: newPatient } = await supabase
    .from("users")
    .insert({
      clinic_id: clinicId,
      name: patientName,
      phone: options?.phone ?? null,
      email: options?.email ?? null,
      role: "patient",
    })
    .select("id")
    .single();

  return newPatient?.id ?? null;
}
