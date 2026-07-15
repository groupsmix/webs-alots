/**
 * POST /api/receptionist/patients — Register a walk-in / phone patient.
 *
 * Front-desk staff (receptionist or clinic_admin) create lightweight patient
 * records that have no auth account (`auth_id: null`). Direct client-side
 * inserts into `users` are rejected by the `users_insert_self_only` RLS
 * policy, so the write is performed here with a clinic-scoped admin client
 * after auth + RBAC + tenant resolution.
 *
 * Requires clinic_admin or receptionist role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { isMinorByDob, MINOR_AGE_THRESHOLD } from "@/lib/minors";
import { createScopedAdminClient } from "@/lib/supabase-server";
import type { TablesInsert, UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["clinic_admin", "receptionist"];

const createPatientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().min(1, "Phone is required").max(40),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
});

async function handlePost(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiError("No clinic context", 400, "NO_CLINIC");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");
  }

  const { name, phone } = parsed.data;
  const email = parsed.data.email || null;
  const dateOfBirth = parsed.data.dateOfBirth || null;

  // Adult-only gating (A200): registering minors requires a parental-consent
  // flow that does not exist yet (Loi 09-08 / RGPD Art. 8).
  if (dateOfBirth && isMinorByDob(dateOfBirth)) {
    return apiError(
      `Patient must be at least ${MINOR_AGE_THRESHOLD}. Registering minors is not supported yet.`,
      400,
      "MINOR_NOT_SUPPORTED",
    );
  }

  try {
    const supabase = createScopedAdminClient("patient-registration", clinicId);

    // Dedupe on phone within the clinic so repeated registrations reuse the
    // existing record instead of creating duplicates.
    const { data: existing } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return apiSuccess(
        {
          patient: { id: existing.id, name: existing.name, phone: existing.phone ?? "" },
          existing: true,
        },
        200,
      );
    }

    // Pick specific columns only — never spread the request body (mass
    // assignment guard). `date_of_birth` is a real column not yet in the
    // generated types, hence the loose payload + cast.
    const { data: created, error } = await supabase
      .from("users")
      .insert({
        clinic_id: clinicId,
        role: "patient",
        name,
        phone,
        email,
        date_of_birth: dateOfBirth,
      } as TablesInsert<"users">)
      .select("id, name, phone")
      .single();

    if (error || !created) {
      logger.warn("Failed to register patient", {
        context: "receptionist/patients",
        error,
      });
      return apiInternalError("Failed to register patient");
    }

    return apiSuccess(
      {
        patient: { id: created.id, name: created.name, phone: created.phone ?? "" },
        existing: false,
      },
      201,
    );
  } catch (err) {
    logger.error("Unexpected error in POST /api/receptionist/patients", { error: err });
    return apiInternalError("Failed to register patient");
  }
}

export const POST = withAuth(handlePost, ALLOWED_ROLES);
