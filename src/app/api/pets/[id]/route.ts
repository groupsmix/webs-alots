/**
 * Pet Profile Detail API — Read, Update, Delete a single pet.
 *
 * GET    /api/pets/[id]  — Get a pet profile
 * PATCH  /api/pets/[id]  — Update a pet profile
 * DELETE /api/pets/[id]  — Delete a pet profile
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiNotFound, apiSupabaseError, apiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { safeParse } from "@/lib/validations";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const updatePetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  species: z.string().min(1).max(100).optional(),
  breed: z.string().max(200).nullable().optional(),
  weight_kg: z.number().positive().max(9999.99).nullable().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Extract the pet ID from the URL path: /api/pets/[id] */
function extractId(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split("/");
  return segments[segments.length - 1];
}

/**
 * GET /api/pets/[id]
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  // API3: Explicit column list to avoid over-fetching.
  const { data, error } = await auth.supabase
    .from("pet_profiles")
    .select("id, clinic_id, owner_id, name, species, breed, weight_kg, date_of_birth, photo_url, notes, is_active, created_at, updated_at")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (error || !data) return apiNotFound("Pet not found");

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist", "doctor", "patient"]);

/**
 * PATCH /api/pets/[id]
 */
export const PATCH = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 422);
  }

  const result = safeParse(updatePetSchema, body);
  if (!result.success) return apiError(result.error, 422);

  const { data, error } = await auth.supabase
    .from("pet_profiles")
    .update(result.data)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .select()
    .single();

  if (error) return apiSupabaseError(error, "pets/update");
  if (!data) return apiNotFound("Pet not found");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "pet_profile.updated",
    type: "patient",
    clinicId,
    description: `Pet profile ${id} updated`,
  });

  return apiSuccess(data);
}, ["super_admin", "clinic_admin", "receptionist", "doctor"]);

/**
 * DELETE /api/pets/[id]
 */
export const DELETE = withAuth(async (request: NextRequest, auth: AuthContext) => {
  const id = extractId(request);
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiNotFound("No clinic context");

  const { error } = await auth.supabase
    .from("pet_profiles")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);

  if (error) return apiSupabaseError(error, "pets/delete");

  await logAuditEvent({
    supabase: auth.supabase,
    action: "pet_profile.deleted",
    type: "admin",
    clinicId,
    description: `Pet profile ${id} deleted`,
  });

  return apiSuccess({ deleted: true });
}, ["super_admin", "clinic_admin"]);
