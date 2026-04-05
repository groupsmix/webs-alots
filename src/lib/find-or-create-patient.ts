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
import { logger } from "@/lib/logger";

interface FindOrCreatePatientOptions {
  phone?: string;
  email?: string;
}

/**
 * Resolve a patient ID — if the incoming ID looks like a temporary placeholder
 * (prefixed with "patient-"), find or create the patient in the database.
 *
 * HIGH-07 FIX: Removed name-based lookup entirely. Phone or email is now
 * REQUIRED to prevent name collision issues (e.g., multiple patients named
 * "Mohammed Ahmed" in the same clinic). If neither is provided, we create
 * a new patient record rather than risk assigning medical data to the wrong
 * person.
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

  // HIGH-07 FIX: Phone or email is REQUIRED. Name-only lookup is too risky
  // in healthcare contexts where multiple patients may share the same name.
  if (!options?.phone && !options?.email) {
    logger.error("findOrCreatePatient: phone or email is required to prevent name collision", {
      context: "find-or-create-patient",
      clinicId,
    });
    return null;
  }

  // Prefer phone-based lookup (unique per clinic) over email
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

  // Email-based lookup as secondary option
  if (options?.email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("email", options.email)
      .eq("role", "patient")
      .limit(1)
      .single();

    if (byEmail) {
      return byEmail.id;
    }
  }

  // No existing patient found — create new record
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
